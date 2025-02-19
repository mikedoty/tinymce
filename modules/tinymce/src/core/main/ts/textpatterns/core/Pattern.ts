import { Arr, Result, Results, Type } from '@ephox/katamari';

import { BlockPattern, InlineCmdPattern, InlinePattern, Pattern, PatternError, PatternSet, RawPattern } from './PatternTypes';

const isInlinePattern = (pattern: Pattern): pattern is InlinePattern =>
  pattern.type === 'inline-command' || pattern.type === 'inline-format';

const isBlockPattern = (pattern: Pattern): pattern is BlockPattern =>
  pattern.type === 'block-command' || pattern.type === 'block-format';

const sortPatterns = <T extends Pattern>(patterns: T[]): T[] => Arr.sort(patterns, (a, b) => {
  if (a.start.length === b.start.length) {
    return 0;
  }
  return a.start.length > b.start.length ? -1 : 1;
});

const normalizePattern = (pattern: RawPattern): Result<Pattern, PatternError> => {
  const err = (message: string) => Result.error({ message, pattern });
  const formatOrCmd = <T> (name: string, onFormat: (formats: string[]) => T, onCommand: (cmd: string, value: any) => T): Result<T, PatternError> => {
    if (pattern.format !== undefined) {
      let formats: string[];
      if (Type.isArray(pattern.format)) {
        if (!Arr.forall(pattern.format, Type.isString)) {
          return err(name + ' pattern has non-string items in the `format` array');
        }
        formats = pattern.format as string[];
      } else if (Type.isString(pattern.format)) {
        formats = [ pattern.format ];
      } else {
        return err(name + ' pattern has non-string `format` parameter');
      }
      return Result.value(onFormat(formats));
    } else if (pattern.cmd !== undefined) {
      if (!Type.isString(pattern.cmd)) {
        return err(name + ' pattern has non-string `cmd` parameter');
      }
      return Result.value(onCommand(pattern.cmd, pattern.value));
    } else {
      return err(name + ' pattern is missing both `format` and `cmd` parameters');
    }
  };
  if (!Type.isObject(pattern)) {
    return err('Raw pattern is not an object');
  }
  if (!Type.isString(pattern.start)) {
    return err('Raw pattern is missing `start` parameter');
  }
  if (pattern.end !== undefined) {
    // inline pattern
    if (!Type.isString(pattern.end)) {
      return err('Inline pattern has non-string `end` parameter');
    }
    if (pattern.start.length === 0 && pattern.end.length === 0) {
      return err('Inline pattern has empty `start` and `end` parameters');
    }
    let start = pattern.start;
    let end = pattern.end;
    // when the end is empty swap with start as it is more efficient
    if (end.length === 0) {
      end = start;
      start = '';
    }
    return formatOrCmd<InlinePattern>('Inline',
      (format) => ({ type: 'inline-format', start, end, format }),
      (cmd, value) => ({ type: 'inline-command', start, end, cmd, value }));
  } else if (pattern.replacement !== undefined) {
    // replacement pattern
    if (!Type.isString(pattern.replacement)) {
      return err('Replacement pattern has non-string `replacement` parameter');
    }
    if (pattern.start.length === 0) {
      return err('Replacement pattern has empty `start` parameter');
    }
    return Result.value<InlineCmdPattern>({
      type: 'inline-command',
      start: '',
      end: pattern.start,
      cmd: 'mceInsertContent',
      value: pattern.replacement
    });
  } else {
    // block pattern
    if (pattern.start.length === 0) {
      return err('Block pattern has empty `start` parameter');
    }
    return formatOrCmd<BlockPattern>('Block', (formats) => ({
      type: 'block-format',
      start: pattern.start,
      format: formats[0]
    }), (command, commandValue) => ({
      type: 'block-command',
      start: pattern.start,
      cmd: command,
      value: commandValue
    }));
  }
};

const getBlockPatterns = (patterns: Pattern[]): BlockPattern[] =>
  sortPatterns(Arr.filter(patterns, isBlockPattern));

const getInlinePatterns = (patterns: Pattern[]): InlinePattern[] =>
  Arr.filter(patterns, isInlinePattern);

const createPatternSet = (patterns: Pattern[]): PatternSet => ({
  inlinePatterns: getInlinePatterns(patterns),
  blockPatterns: getBlockPatterns(patterns)
});

const fromRawPatterns = (patterns: RawPattern[]): Pattern[] => {
  const normalized = Results.partition(Arr.map(patterns, normalizePattern));
  // eslint-disable-next-line no-console
  Arr.each(normalized.errors, (err) => console.error(err.message, err.pattern));
  return normalized.values;
};

export {
  normalizePattern,
  createPatternSet,
  getBlockPatterns,
  getInlinePatterns,
  fromRawPatterns
};
