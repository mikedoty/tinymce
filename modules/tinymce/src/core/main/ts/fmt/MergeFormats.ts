import DOMUtils from '../api/dom/DOMUtils';
import Editor from '../api/Editor';
import Tools from '../api/util/Tools';
import * as NodeType from '../dom/NodeType';
import { ApplyFormat, FormatVars } from './FormatTypes';
import * as FormatUtils from './FormatUtils';
import * as MatchFormat from './MatchFormat';
import { applyStyle, clearChildStyles, hasStyle, isElementNode, mergeSiblings, processChildElements } from './MergeUtils';
import * as RemoveFormat from './RemoveFormat';

const each = Tools.each;

const mergeTextDecorationsAndColor = (dom: DOMUtils, format: ApplyFormat, vars: FormatVars | undefined, node: Node): void => {
  const processTextDecorationsAndColor = (n: Node) => {
    if (NodeType.isElement(n) && NodeType.isElement(n.parentNode)) {
      const textDecoration = FormatUtils.getTextDecoration(dom, n.parentNode);
      if (dom.getStyle(n, 'color') && textDecoration) {
        dom.setStyle(n, 'text-decoration', textDecoration);
      } else if (dom.getStyle(n, 'text-decoration') === textDecoration) {
        dom.setStyle(n, 'text-decoration', null);
      }
    }
  };

  // Colored nodes should be underlined so that the color of the underline matches the text color.
  if (format.styles && (format.styles.color || format.styles.textDecoration)) {
    Tools.walk(node, processTextDecorationsAndColor, 'childNodes');
    processTextDecorationsAndColor(node);
  }
};

const mergeBackgroundColorAndFontSize = (dom: DOMUtils, format: ApplyFormat, vars: FormatVars | undefined, node: Node): void => {
  // nodes with font-size should have their own background color as well to fit the line-height (see TINY-882)
  if (format.styles && format.styles.backgroundColor) {
    processChildElements(node,
      hasStyle(dom, 'fontSize'),
      applyStyle(dom, 'backgroundColor', FormatUtils.replaceVars(format.styles.backgroundColor, vars))
    );
  }
};

const mergeSubSup = (dom: DOMUtils, format: ApplyFormat, vars: FormatVars | undefined, node: Node): void => {
  // Remove font size on all children of a sub/sup and remove the inverse element
  if (FormatUtils.isInlineFormat(format) && (format.inline === 'sub' || format.inline === 'sup')) {
    processChildElements(node,
      hasStyle(dom, 'fontSize'),
      applyStyle(dom, 'fontSize', '')
    );

    dom.remove(dom.select(format.inline === 'sup' ? 'sub' : 'sup', node), true);
  }
};

const mergeWithChildren = (editor: Editor, formatList: ApplyFormat[], vars: FormatVars | undefined, node: Node): void => {
  // Remove/merge children
  each(formatList, (format) => {
    // Merge all children of similar type will move styles from child to parent
    // this: <span style="color:red"><b><span style="color:red; font-size:10px">text</span></b></span>
    // will become: <span style="color:red"><b><span style="font-size:10px">text</span></b></span>
    if (FormatUtils.isInlineFormat(format)) {
      each(editor.dom.select(format.inline, node), (child) => {
        if (isElementNode(child)) {
          RemoveFormat.removeFormat(editor, format, vars, child, format.exact ? child : null);
        }
      });
    }

    clearChildStyles(editor.dom, format, node);
  });
};

const mergeWithParents = (editor: Editor, format: ApplyFormat, name: string, vars: FormatVars | undefined, node: Node): void => {
  // Remove format if direct parent already has the same format
  const parentNode = node.parentNode;
  if (MatchFormat.matchNode(editor, parentNode, name, vars)) {
    if (RemoveFormat.removeFormat(editor, format, vars, node)) {
      return;
    }
  }

  // Remove format if any ancestor already has the same format
  if (format.merge_with_parents && parentNode) {
    editor.dom.getParent(parentNode, (parent) => {
      if (MatchFormat.matchNode(editor, parent, name, vars)) {
        RemoveFormat.removeFormat(editor, format, vars, node);
        return true;
      } else {
        return false;
      }
    });
  }
};

export {
  mergeWithChildren,
  mergeTextDecorationsAndColor,
  mergeBackgroundColorAndFontSize,
  mergeSubSup,
  mergeSiblings,
  mergeWithParents
};
