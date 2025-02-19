import { Strings } from '@ephox/katamari';

import DOMUtils from '../api/dom/DOMUtils';
import ElementUtils from '../api/dom/ElementUtils';
import Tools from '../api/util/Tools';
import * as Bookmarks from '../bookmark/Bookmarks';
import * as NodeType from '../dom/NodeType';
import { isCaretNode } from './FormatContainer';
import { ApplyFormat, FormatVars } from './FormatTypes';
import * as FormatUtils from './FormatUtils';

const each = Tools.each;

const isElementNode = (node: Node): node is Element =>
  NodeType.isElement(node) && !Bookmarks.isBookmarkNode(node) && !isCaretNode(node) && !NodeType.isBogus(node);

const findElementSibling = (node: Node, siblingName: 'nextSibling' | 'previousSibling') => {
  for (let sibling: Node | null = node; sibling; sibling = sibling[siblingName]) {
    if (NodeType.isText(sibling) && Strings.isNotEmpty(sibling.data)) {
      return node;
    }

    if (NodeType.isElement(sibling) && !Bookmarks.isBookmarkNode(sibling)) {
      return sibling;
    }
  }

  return node;
};

const mergeSiblingsNodes = (dom: DOMUtils, prev: Node | undefined, next: Node | undefined) => {
  const elementUtils = ElementUtils(dom);

  // Check if next/prev exists and that they are elements
  if (prev && next) {
    // If previous sibling is empty then jump over it
    const prevSibling = findElementSibling(prev, 'previousSibling');
    const nextSibling = findElementSibling(next, 'nextSibling');

    // Compare next and previous nodes
    if (elementUtils.compare(prevSibling, nextSibling)) {
      // Append nodes between
      for (let sibling = prevSibling.nextSibling; sibling && sibling !== nextSibling;) {
        const tmpSibling = sibling;
        sibling = sibling.nextSibling;
        prevSibling.appendChild(tmpSibling);
      }

      dom.remove(nextSibling);

      Tools.each(Tools.grep(nextSibling.childNodes), (node) => {
        prevSibling.appendChild(node);
      });

      return prevSibling;
    }
  }

  return next;
};

const mergeSiblings = (dom: DOMUtils, format: ApplyFormat, vars: FormatVars | undefined, node: Node): void => {
  // Merge next and previous siblings if they are similar <b>text</b><b>text</b> becomes <b>texttext</b>
  if (node && format.merge_siblings !== false) {
    // Previous sibling
    const newNode = mergeSiblingsNodes(dom, FormatUtils.getNonWhiteSpaceSibling(node), node) ?? node;
    // Next sibling
    mergeSiblingsNodes(dom, newNode, FormatUtils.getNonWhiteSpaceSibling(newNode, true));
  }
};

const clearChildStyles = (dom: DOMUtils, format: ApplyFormat, node: Node): void => {
  if (format.clear_child_styles) {
    const selector = format.links ? '*:not(a)' : '*';
    each(dom.select(selector, node), (node) => {
      if (isElementNode(node)) {
        each(format.styles, (value, name: string) => {
          dom.setStyle(node, name, '');
        });
      }
    });
  }
};

const processChildElements = (node: Node, filter: (element: Element) => boolean, process: (element: Element) => void): void => {
  each(node.childNodes, (node) => {
    if (isElementNode(node)) {
      if (filter(node)) {
        process(node);
      }
      if (node.hasChildNodes()) {
        processChildElements(node, filter, process);
      }
    }
  });
};

const unwrapEmptySpan = (dom: DOMUtils, node: Node) => {
  if (node.nodeName === 'SPAN' && dom.getAttribs(node as HTMLSpanElement).length === 0) {
    dom.remove(node, true);
  }
};

const hasStyle = (dom: DOMUtils, name: string) => (node: Element): boolean =>
  !!(node && FormatUtils.getStyle(dom, node, name));

const applyStyle = (dom: DOMUtils, name: string, value: string | null) => (node: Element): void => {
  dom.setStyle(node, name, value);

  if (node.getAttribute('style') === '') {
    node.removeAttribute('style');
  }

  unwrapEmptySpan(dom, node);
};

export {
  applyStyle,
  clearChildStyles,
  hasStyle,
  isElementNode,
  mergeSiblings,
  processChildElements
};
