import { Arr, Fun, Obj } from '@ephox/katamari';
import { SugarElement } from '@ephox/sugar';

import Editor from './api/Editor';
import { SchemaMap } from './api/html/Schema';
import * as Options from './api/Options';
import * as Bookmarks from './bookmark/Bookmarks';
import * as NodeType from './dom/NodeType';
import * as Parents from './dom/Parents';
import * as EditorFocus from './focus/EditorFocus';

/**
 * Makes sure that everything gets wrapped in paragraphs.
 *
 * @private
 * @class tinymce.ForceBlocks
 */

const isBlockElement = (blockElements: SchemaMap, node: Node) =>
  Obj.has(blockElements, node.nodeName);

const isValidTarget = (blockElements: SchemaMap, node: Node) => {
  if (NodeType.isText(node)) {
    return true;
  } else if (NodeType.isElement(node)) {
    return !isBlockElement(blockElements, node) && !Bookmarks.isBookmarkNode(node);
  } else {
    return false;
  }
};

const hasBlockParent = (blockElements: SchemaMap, root: Node, node: Node) => {
  return Arr.exists(Parents.parents(SugarElement.fromDom(node), SugarElement.fromDom(root)), (elm) => {
    return isBlockElement(blockElements, elm.dom);
  });
};

// const is

const shouldRemoveTextNode = (blockElements: SchemaMap, node: Node) => {
  if (NodeType.isText(node)) {
    if (node.data.length === 0) {
      return true;
    } else if (/^\s+$/.test(node.data) && (!node.nextSibling || isBlockElement(blockElements, node.nextSibling))) {
      return true;
    }
  }

  return false;
};

const addRootBlocks = (editor: Editor) => {
  const dom = editor.dom, selection = editor.selection;
  const schema = editor.schema, blockElements = schema.getBlockElements();
  const startNode = selection.getStart();
  const rootNode = editor.getBody();
  let rootBlockNode: Node | undefined | null;
  let tempNode: Node;
  let wrapped = false;

  const forcedRootBlock = Options.getForcedRootBlock(editor);
  if (!startNode || !NodeType.isElement(startNode)) {
    return;
  }

  const rootNodeName = rootNode.nodeName.toLowerCase();
  if (!schema.isValidChild(rootNodeName, forcedRootBlock.toLowerCase()) || hasBlockParent(blockElements, rootNode, startNode)) {
    return;
  }

  // Get current selection
  const rng = selection.getRng();
  const { startContainer, startOffset, endContainer, endOffset } = rng;
  const restoreSelection = EditorFocus.hasFocus(editor);

  // Wrap non block elements and text nodes
  let node = rootNode.firstChild;
  while (node) {
    if (isValidTarget(blockElements, node)) {
      // Remove empty text nodes and nodes containing only whitespace
      if (shouldRemoveTextNode(blockElements, node)) {
        tempNode = node;
        node = node.nextSibling;
        dom.remove(tempNode);
        continue;
      }

      if (!rootBlockNode) {
        rootBlockNode = dom.create(forcedRootBlock, Options.getForcedRootBlockAttrs(editor));
        rootNode.insertBefore(rootBlockNode, node);
        wrapped = true;
      }

      tempNode = node;
      node = node.nextSibling;
      rootBlockNode.appendChild(tempNode);
    } else {
      rootBlockNode = null;
      node = node.nextSibling;
    }
  }

  if (wrapped && restoreSelection) {
    rng.setStart(startContainer, startOffset);
    rng.setEnd(endContainer, endOffset);
    selection.setRng(rng);
    editor.nodeChanged();
  }
};

const setup = (editor: Editor): void => {
  editor.on('NodeChange', Fun.curry(addRootBlocks, editor));
};

export {
  setup
};
