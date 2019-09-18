"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mib2json = mib2json;
exports.convert = convert;
exports.convertDir = convertDir;
exports.getMibs = getMibs;
exports.getMibsSync = getMibsSync;

require("source-map-support/register");

var _fs = _interopRequireDefault(require("fs"));

var _iconvLite = require("iconv-lite");

var path = _interopRequireWildcard(require("path"));

var _sax = _interopRequireDefault(require("sax"));

var _stream = require("stream");

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; if (obj != null) { var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
class Utf8Converter extends _stream.Transform {
  constructor(encoding) {
    super();
    this.encoding = encoding;

    if (!(0, _iconvLite.encodingExists)(encoding)) {
      throw new Error(`encoding ${encoding} is not supported`);
    }
  } // tslint:disable-next-line


  _transform(chunk, _encoding, callback) {
    callback(undefined, (0, _iconvLite.decode)(chunk, this.encoding));
  }

}

function getEncoding(mibpath) {
  return new Promise((resolve, reject) => {
    let encoding;

    const saxStream = _sax.default.createStream(true, {});

    saxStream.on('error', err => reject(err));
    saxStream.on('processinginstruction', pi => {
      if (!pi.body) {
        return;
      }

      const match = /encoding="(.*)"/g.exec(pi.body);

      if (match) {
        [, encoding] = match;
      }
    });
    saxStream.on('end', () => resolve(encoding));

    _fs.default.createReadStream(mibpath).pipe(saxStream);
  });
}

function mib2json(mibpath) {
  return new Promise((resolve, reject) => {
    const saxStream = _sax.default.createStream(true, {
      xmlns: true,
      trim: true,
      normalize: true
    });

    saxStream.on('error', err => reject(err));
    const root = {};
    let level = 0;
    let current;
    const types = {};
    let subroutines;
    const trail = [];
    let state;
    saxStream.on('opentag', tag => {
      //      logger.element(util.inspect(tag, {depth: null}));
      if (level < 5 || subroutines) {
        switch (tag.local) {
          case 'element':
            if (level === 1) {
              root[tag.attributes.name.value] = tag.attributes.type.value;
            } else if (subroutines) {
              current = subroutines[tag.attributes.name.value] = {};
            }

            break;

          case 'simpleType':
          case 'complexType':
            if (level === 1) {
              current = types[tag.attributes.name.value] = {};
              trail.length = 0;
            }

            break;

          case 'sequence':
            if (level === 2) {
              trail.push(current);
              current = false;
              root.subroutines = subroutines = {};
            }

            break;

          case 'annotation':
            state = 'annotation';
            break;

          case 'appinfo':
            current.appinfo = {};
            state = 'appinfo';
            break;

          case 'restriction':
            current.base = tag.attributes.base.value;
            break;

          case 'minInclusive':
          case 'maxInclusive':
          case 'minExclusive':
          case 'maxExclusive':
            current[tag.local] = tag.attributes.value.value;
            break;

          case 'enumeration':
            current.enumeration = current.enumeration || {};
            trail.push(current);
            current = current.enumeration[tag.attributes.value.value] = {};
            break;

          case 'attribute':
            current.properties = current.properties || {};
            trail.push(current);
            current = current.properties[tag.attributes.name.value] = {
              type: tag.attributes.type.value
            };
            break;
        }
      }

      level += 1;
    });
    saxStream.on('closetag', tagName => {
      level -= 1;

      if (tagName === 'xs:sequence') {
        subroutines = false;
        current = trail.pop();
      } else if (current) {
        if (tagName === 'xs:attribute' || tagName === 'xs:enumeration') {
          current = trail.pop();
        }
      }
    });

    const textHandler = function (text) {
      if (current) {
        if (state === 'appinfo') {
          const local = this._parser.tag.local;
          const appinfo = current.appinfo;

          if (appinfo[local]) {
            appinfo[local] += `
${text}`;
          } else {
            appinfo[local] = text;
          }
        }

        state === 'annotation' && (current.annotation = text);
      }
    };

    saxStream.on('text', textHandler);
    saxStream.on('end', () => {
      root.types = types;
      resolve(root);
    });
    getEncoding(mibpath).then(encoding => {
      let input = _fs.default.createReadStream(mibpath);

      if (encoding && (0, _iconvLite.encodingExists)(encoding)) {
        input = input.pipe(new Utf8Converter(encoding));
      }

      input.pipe(saxStream);
    }).catch(reject);
  });
}

async function convert(mibpath, dir) {
  const json = await mib2json(mibpath);
  let jsonpath = `${mibpath.replace(/\.[^/.]+$/, '')}.json`;

  if (dir) {
    jsonpath = path.resolve(dir, path.basename(jsonpath));
  }

  const data = JSON.stringify(json, null, 2);
  return new Promise((resolve, reject) => {
    _fs.default.writeFile(jsonpath, data, err => {
      if (err) {
        reject(err);
      } else {
        resolve(jsonpath);
      }
    });
  });
}

const xsdMibRe = /^\S+\.mib\.xsd$/i;
const jsonMibRe = /^(\S+)\.mib\.json$/i;

function convertDir(dir) {
  return new Promise((resolve, reject) => {
    _fs.default.readdir(dir, (err, files) => {
      if (err) {
        return reject(err);
      }

      const promises = files.filter(file => xsdMibRe.test(file)).map(file => convert(path.join(dir, file)).then(() => console.info(`${file}: success`)).catch(error => console.error(`${file}: ${error.message}`)));
      resolve(Promise.all(promises).then(() => void 0));
    });
  });
}

let mibs = [];
const mibsDir = path.resolve(__dirname, '../../mibs');

function filesToMibs(files) {
  return files.map(file => jsonMibRe.exec(file)).filter(matches => matches != null).map(matches => matches[1]);
}

function getMibs() {
  return new Promise((resolve, reject) => {
    _fs.default.readdir(mibsDir, (err, files) => {
      if (err) {
        mibs = [];
        return reject(err);
      }

      mibs = filesToMibs(files);
      resolve(mibs);
    });
  });
}

function getMibsSync() {
  if (!mibs || mibs.length === 0) {
    mibs = filesToMibs(_fs.default.readdirSync(mibsDir));
  }

  return mibs;
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9taWIvbWliMmpzb24udHMiXSwibmFtZXMiOlsiVXRmOENvbnZlcnRlciIsIlRyYW5zZm9ybSIsImNvbnN0cnVjdG9yIiwiZW5jb2RpbmciLCJFcnJvciIsIl90cmFuc2Zvcm0iLCJjaHVuayIsIl9lbmNvZGluZyIsImNhbGxiYWNrIiwidW5kZWZpbmVkIiwiZ2V0RW5jb2RpbmciLCJtaWJwYXRoIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJzYXhTdHJlYW0iLCJzYXgiLCJjcmVhdGVTdHJlYW0iLCJvbiIsImVyciIsInBpIiwiYm9keSIsIm1hdGNoIiwiZXhlYyIsImZzIiwiY3JlYXRlUmVhZFN0cmVhbSIsInBpcGUiLCJtaWIyanNvbiIsInhtbG5zIiwidHJpbSIsIm5vcm1hbGl6ZSIsInJvb3QiLCJsZXZlbCIsImN1cnJlbnQiLCJ0eXBlcyIsInN1YnJvdXRpbmVzIiwidHJhaWwiLCJzdGF0ZSIsInRhZyIsImxvY2FsIiwiYXR0cmlidXRlcyIsIm5hbWUiLCJ2YWx1ZSIsInR5cGUiLCJsZW5ndGgiLCJwdXNoIiwiYXBwaW5mbyIsImJhc2UiLCJlbnVtZXJhdGlvbiIsInByb3BlcnRpZXMiLCJ0YWdOYW1lIiwicG9wIiwidGV4dEhhbmRsZXIiLCJ0ZXh0IiwiX3BhcnNlciIsImFubm90YXRpb24iLCJ0aGVuIiwiaW5wdXQiLCJjYXRjaCIsImNvbnZlcnQiLCJkaXIiLCJqc29uIiwianNvbnBhdGgiLCJyZXBsYWNlIiwicGF0aCIsImJhc2VuYW1lIiwiZGF0YSIsIkpTT04iLCJzdHJpbmdpZnkiLCJ3cml0ZUZpbGUiLCJ4c2RNaWJSZSIsImpzb25NaWJSZSIsImNvbnZlcnREaXIiLCJyZWFkZGlyIiwiZmlsZXMiLCJwcm9taXNlcyIsImZpbHRlciIsImZpbGUiLCJ0ZXN0IiwibWFwIiwiam9pbiIsImNvbnNvbGUiLCJpbmZvIiwiZXJyb3IiLCJtZXNzYWdlIiwiYWxsIiwibWlicyIsIm1pYnNEaXIiLCJfX2Rpcm5hbWUiLCJm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QUlOLFNBQVMsQ0FBQ2hELElBQVYsQ0FBZXNELElBQWYsQ0FEUixFQUVKRCxNQUZJLENBRUdjLE9BQU8sSUFBSUEsT0FBTyxJQUFJLElBRnpCLEVBR0pYLEdBSEksQ0FHQVcsT0FBTyxJQUFJQSxPQUFPLENBQUUsQ0FBRixDQUhsQixDQUFQO0FBSUQ7O0FBRU0sU0FBU0MsT0FBVCxHQUFzQztBQUMzQyxTQUFPLElBQUkvRSxPQUFKLENBQVksQ0FBQ0MsT0FBRCxFQUFVQyxNQUFWLEtBQXFCO0FBQ3RDVSxnQkFBR2lELE9BQUgsQ0FBV2MsT0FBWCxFQUFvQixDQUFDcEUsR0FBRCxFQUFNdUQsS0FBTixLQUFnQjtBQUNsQyxVQUFJdkQsR0FBSixFQUFTO0FBQ1BtRSxRQUFBQSxJQUFJLEdBQUcsRUFBUDtBQUNBLGVBQU94RSxNQUFNLENBQUNLLEdBQUQsQ0FBYjtBQUNEOztBQUNEbUUsTUFBQUEsSUFBSSxHQUFHRyxXQUFXLENBQUNmLEtBQUQsQ0FBbEI7QUFDQTdELE1BQUFBLE9BQU8sQ0FBQ3lFLElBQUQsQ0FBUDtBQUNELEtBUEQ7QUFRRCxHQVRNLENBQVA7QUFVRDs7QUFFTSxTQUFTTSxXQUFULEdBQWlDO0FBQ3RDLE1BQUksQ0FBQ04sSUFBRCxJQUFTQSxJQUFJLENBQUMxQyxNQUFMLEtBQWdCLENBQTdCLEVBQWdDO0FBQzlCMEMsSUFBQUEsSUFBSSxHQUFHRyxXQUFXLENBQUNqRSxZQUFHcUUsV0FBSCxDQUFlTixPQUFmLENBQUQsQ0FBbEI7QUFDRDs7QUFDRCxTQUFPRCxJQUFQO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gT09PIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbmltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyBkZWNvZGUsIGVuY29kaW5nRXhpc3RzIH0gZnJvbSAnaWNvbnYtbGl0ZSc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHNheCwgeyBTQVhTdHJlYW0gfSBmcm9tICdzYXgnO1xuaW1wb3J0IHsgU3RyZWFtLCBUcmFuc2Zvcm0sIFRyYW5zZm9ybUNhbGxiYWNrIH0gZnJvbSAnc3RyZWFtJztcblxudHlwZSBUZXh0SGFuZGxlciA9ICh0aGlzOiBTQVhTdHJlYW0sIHRleHQ6IHN0cmluZykgPT4gdm9pZDtcblxuY2xhc3MgVXRmOENvbnZlcnRlciBleHRlbmRzIFRyYW5zZm9ybSB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBlbmNvZGluZzogc3RyaW5nKSB7XG4gICAgc3VwZXIoKTtcbiAgICBpZiAoIWVuY29kaW5nRXhpc3RzKGVuY29kaW5nKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBlbmNvZGluZyAke2VuY29kaW5nfSBpcyBub3Qgc3VwcG9ydGVkYCk7XG4gICAgfVxuICB9XG5cbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lXG4gIHB1YmxpYyBfdHJhbnNmb3JtKGNodW5rOiBhbnksIF9lbmNvZGluZzogc3RyaW5nLCBjYWxsYmFjazogVHJhbnNmb3JtQ2FsbGJhY2spOiB2b2lkIHtcbiAgICBjYWxsYmFjayh1bmRlZmluZWQsIGRlY29kZShjaHVuaywgdGhpcy5lbmNvZGluZykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEVuY29kaW5nKG1pYnBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgbGV0IGVuY29kaW5nOiBzdHJpbmc7XG4gICAgY29uc3Qgc2F4U3RyZWFtID0gc2F4LmNyZWF0ZVN0cmVhbSh0cnVlLCB7fSk7XG4gICAgc2F4U3RyZWFtLm9uKCdlcnJvcicsIGVyciA9PiByZWplY3QoZXJyKSk7XG4gICAgc2F4U3RyZWFtLm9uKCdwcm9jZXNzaW5naW5zdHJ1Y3Rpb24nLCAocGkpID0+IHtcbiAgICAgIGlmICghcGkuYm9keSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb25zdCBtYXRjaCA9IC9lbmNvZGluZz1cIiguKilcIi9nLmV4ZWMocGkuYm9keSk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgWywgZW5jb2RpbmddID0gbWF0Y2g7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2F4U3RyZWFtLm9uKCdlbmQnLCAoKSA9PiByZXNvbHZlKGVuY29kaW5nKSk7XG4gICAgZnMuY3JlYXRlUmVhZFN0cmVhbShtaWJwYXRoKS5waXBlKHNheFN0cmVhbSk7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gbWliMmpzb24obWlicGF0aDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPGFueT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGNvbnN0IHNheFN0cmVhbSA9IHNheC5jcmVhdGVTdHJlYW0oXG4gICAgICB0cnVlLFxuICAgICAge1xuICAgICAgICB4bWxuczogdHJ1ZSxcbiAgICAgICAgdHJpbTogdHJ1ZSxcbiAgICAgICAgbm9ybWFsaXplOiB0cnVlLFxuICAgICAgfSxcbiAgICApO1xuICAgIHNheFN0cmVhbS5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpO1xuICAgIGNvbnN0IHJvb3Q6IGFueSA9IHt9O1xuICAgIGxldCBsZXZlbCA9IDA7XG4gICAgbGV0IGN1cnJlbnQ6IGFueTtcbiAgICBjb25zdCB0eXBlczogYW55ID0ge307XG4gICAgbGV0IHN1YnJvdXRpbmVzOiBhbnk7XG4gICAgY29uc3QgdHJhaWw6IGFueVtdID0gW107XG4gICAgbGV0IHN0YXRlOiBzdHJpbmc7XG4gICAgc2F4U3RyZWFtLm9uKCdvcGVudGFnJywgKHRhZykgPT4ge1xuLy8gICAgICBsb2dnZXIuZWxlbWVudCh1dGlsLmluc3BlY3QodGFnLCB7ZGVwdGg6IG51bGx9KSk7XG4gICAgICBpZiAobGV2ZWwgPCA1IHx8IHN1YnJvdXRpbmVzKSB7XG4gICAgICAgIHN3aXRjaCAodGFnLmxvY2FsKSB7XG4gICAgICAgICAgY2FzZSAnZWxlbWVudCc6XG4gICAgICAgICAgICBpZiAobGV2ZWwgPT09IDEpIHtcbiAgICAgICAgICAgICAgcm9vdFt0YWcuYXR0cmlidXRlcy5uYW1lLnZhbHVlXSA9IHRhZy5hdHRyaWJ1dGVzLnR5cGUudmFsdWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHN1YnJvdXRpbmVzKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnQgPSBzdWJyb3V0aW5lc1t0YWcuYXR0cmlidXRlcy5uYW1lLnZhbHVlXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc2ltcGxlVHlwZSc6XG4gICAgICAgICAgY2FzZSAnY29tcGxleFR5cGUnOlxuICAgICAgICAgICAgaWYgKGxldmVsID09PSAxKSB7XG4gICAgICAgICAgICAgIGN1cnJlbnQgPSB0eXBlc1t0YWcuYXR0cmlidXRlcy5uYW1lLnZhbHVlXSA9IHt9O1xuICAgICAgICAgICAgICB0cmFpbC5sZW5ndGggPSAwO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnc2VxdWVuY2UnOlxuICAgICAgICAgICAgaWYgKGxldmVsID09PSAyKSB7XG4gICAgICAgICAgICAgIHRyYWlsLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICAgIGN1cnJlbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgcm9vdC5zdWJyb3V0aW5lcyA9IHN1YnJvdXRpbmVzID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlICdhbm5vdGF0aW9uJzpcbiAgICAgICAgICAgIHN0YXRlID0gJ2Fubm90YXRpb24nO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnYXBwaW5mbyc6XG4gICAgICAgICAgICBjdXJyZW50LmFwcGluZm8gPSB7fTtcbiAgICAgICAgICAgIHN0YXRlID0gJ2FwcGluZm8nO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAncmVzdHJpY3Rpb24nOlxuICAgICAgICAgICAgY3VycmVudC5iYXNlID0gdGFnLmF0dHJpYnV0ZXMuYmFzZS52YWx1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ21pbkluY2x1c2l2ZSc6XG4gICAgICAgICAgY2FzZSAnbWF4SW5jbHVzaXZlJzpcbiAgICAgICAgICBjYXNlICdtaW5FeGNsdXNpdmUnOlxuICAgICAgICAgIGNhc2UgJ21heEV4Y2x1c2l2ZSc6XG4gICAgICAgICAgICBjdXJyZW50W3RhZy5sb2NhbF0gPSB0YWcuYXR0cmlidXRlcy52YWx1ZS52YWx1ZTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIGNhc2UgJ2VudW1lcmF0aW9uJzpcbiAgICAgICAgICAgIGN1cnJlbnQuZW51bWVyYXRpb24gPSBjdXJyZW50LmVudW1lcmF0aW9uIHx8IHt9O1xuICAgICAgICAgICAgdHJhaWwucHVzaChjdXJyZW50KTtcbiAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50LmVudW1lcmF0aW9uW3RhZy5hdHRyaWJ1dGVzLnZhbHVlLnZhbHVlXSA9IHt9O1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgY2FzZSAnYXR0cmlidXRlJzpcbiAgICAgICAgICAgIGN1cnJlbnQucHJvcGVydGllcyA9IGN1cnJlbnQucHJvcGVydGllcyB8fCB7fTtcbiAgICAgICAgICAgIHRyYWlsLnB1c2goY3VycmVudCk7XG4gICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudC5wcm9wZXJ0aWVzW3RhZy5hdHRyaWJ1dGVzLm5hbWUudmFsdWVdID1cbiAgICAgICAgICAgICAgeyB0eXBlOiB0YWcuYXR0cmlidXRlcy50eXBlLnZhbHVlIH07XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbGV2ZWwgKz0gMTtcbiAgICB9KTtcblxuICAgIHNheFN0cmVhbS5vbignY2xvc2V0YWcnLCAodGFnTmFtZSkgPT4ge1xuICAgICAgbGV2ZWwgLT0gMTtcblxuICAgICAgaWYgKHRhZ05hbWUgPT09ICd4czpzZXF1ZW5jZScpIHtcbiAgICAgICAgc3Vicm91dGluZXMgPSBmYWxzZTtcbiAgICAgICAgY3VycmVudCA9IHRyYWlsLnBvcCgpO1xuICAgICAgfSBlbHNlIGlmIChjdXJyZW50KSB7XG4gICAgICAgIGlmICh0YWdOYW1lID09PSAneHM6YXR0cmlidXRlJyB8fCB0YWdOYW1lID09PSAneHM6ZW51bWVyYXRpb24nKSB7XG4gICAgICAgICAgY3VycmVudCA9IHRyYWlsLnBvcCgpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB0ZXh0SGFuZGxlcjogVGV4dEhhbmRsZXIgPSBmdW5jdGlvbiAodGV4dCkge1xuICAgICAgaWYgKGN1cnJlbnQpIHtcbiAgICAgICAgaWYgKHN0YXRlID09PSAnYXBwaW5mbycpIHtcbiAgICAgICAgICBjb25zdCBsb2NhbCA9IHRoaXMuX3BhcnNlci50YWcubG9jYWw7XG4gICAgICAgICAgY29uc3QgYXBwaW5mbyA9IGN1cnJlbnQuYXBwaW5mbztcbiAgICAgICAgICBpZiAoYXBwaW5mb1tsb2NhbF0pIHtcbiAgICAgICAgICAgIGFwcGluZm9bbG9jYWxdICs9IGBcbiR7dGV4dH1gO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhcHBpbmZvW2xvY2FsXSA9IHRleHQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHN0YXRlID09PSAnYW5ub3RhdGlvbicgJiYgKGN1cnJlbnQuYW5ub3RhdGlvbiA9IHRleHQpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBzYXhTdHJlYW0ub24oJ3RleHQnLCB0ZXh0SGFuZGxlcik7XG5cbiAgICBzYXhTdHJlYW0ub24oJ2VuZCcsICgpID0+IHtcbiAgICAgIHJvb3QudHlwZXMgPSB0eXBlcztcbiAgICAgIHJlc29sdmUocm9vdCk7XG4gICAgfSk7XG5cbiAgICBnZXRFbmNvZGluZyhtaWJwYXRoKVxuICAgICAgLnRoZW4oKGVuY29kaW5nKSA9PiB7XG4gICAgICAgIGxldCBpbnB1dDogU3RyZWFtID0gZnMuY3JlYXRlUmVhZFN0cmVhbShtaWJwYXRoKTtcbiAgICAgICAgaWYgKGVuY29kaW5nICYmIGVuY29kaW5nRXhpc3RzKGVuY29kaW5nKSkge1xuICAgICAgICAgIGlucHV0ID0gaW5wdXQucGlwZShuZXcgVXRmOENvbnZlcnRlcihlbmNvZGluZykpO1xuICAgICAgICB9XG4gICAgICAgIGlucHV0LnBpcGUoc2F4U3RyZWFtKTtcbiAgICAgIH0pXG4gICAgICAuY2F0Y2gocmVqZWN0KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjb252ZXJ0KG1pYnBhdGg6IHN0cmluZywgZGlyPzogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QganNvbiA9IGF3YWl0IG1pYjJqc29uKG1pYnBhdGgpO1xuICBsZXQganNvbnBhdGggPSBgJHttaWJwYXRoLnJlcGxhY2UoL1xcLlteLy5dKyQvLCAnJyl9Lmpzb25gO1xuICBpZiAoZGlyKSB7XG4gICAganNvbnBhdGggPSBwYXRoLnJlc29sdmUoZGlyLCBwYXRoLmJhc2VuYW1lKGpzb25wYXRoKSk7XG4gIH1cbiAgY29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KGpzb24sIG51bGwsIDIpO1xuICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgZnMud3JpdGVGaWxlKGpzb25wYXRoLCBkYXRhLCAoZXJyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB7XG4gICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzb2x2ZShqc29ucGF0aCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuXG5jb25zdCB4c2RNaWJSZSA9IC9eXFxTK1xcLm1pYlxcLnhzZCQvaTtcbmNvbnN0IGpzb25NaWJSZSA9IC9eKFxcUyspXFwubWliXFwuanNvbiQvaTtcblxuZXhwb3J0IGZ1bmN0aW9uIGNvbnZlcnREaXIoZGlyOiBzdHJpbmcpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICBmcy5yZWFkZGlyKGRpciwgKGVyciwgZmlsZXMpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgfVxuICAgICAgY29uc3QgcHJvbWlzZXM6IFByb21pc2U8dm9pZD5bXSA9IGZpbGVzXG4gICAgICAgIC5maWx0ZXIoZmlsZSA9PiB4c2RNaWJSZS50ZXN0KGZpbGUpKVxuICAgICAgICAubWFwKGZpbGUgPT4gY29udmVydChwYXRoLmpvaW4oZGlyLCBmaWxlKSlcbiAgICAgICAgICAudGhlbigoKSA9PiBjb25zb2xlLmluZm8oYCR7ZmlsZX06IHN1Y2Nlc3NgKSlcbiAgICAgICAgICAuY2F0Y2goZXJyb3IgPT4gY29uc29sZS5lcnJvcihgJHtmaWxlfTogJHtlcnJvci5tZXNzYWdlfWApKSxcbiAgICAgICAgKTtcbiAgICAgIHJlc29sdmUoUHJvbWlzZS5hbGwocHJvbWlzZXMpLnRoZW4oKCkgPT4gdm9pZCAwKSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5sZXQgbWliczogc3RyaW5nW10gPSBbXTtcbmNvbnN0IG1pYnNEaXIgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vbWlicycpO1xuXG5mdW5jdGlvbiBmaWxlc1RvTWlicyhmaWxlczogc3RyaW5nW10pIHtcbiAgcmV0dXJuIGZpbGVzXG4gICAgLm1hcChmaWxlID0+IGpzb25NaWJSZS5leGVjKGZpbGUpKVxuICAgIC5maWx0ZXIobWF0Y2hlcyA9PiBtYXRjaGVzICE9IG51bGwpXG4gICAgLm1hcChtYXRjaGVzID0+IG1hdGNoZXMhWzFdKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1pYnMoKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGZzLnJlYWRkaXIobWlic0RpciwgKGVyciwgZmlsZXMpID0+IHtcbiAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgbWlicyA9IFtdO1xuICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XG4gICAgICB9XG4gICAgICBtaWJzID0gZmlsZXNUb01pYnMoZmlsZXMpO1xuICAgICAgcmVzb2x2ZShtaWJzKTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRNaWJzU3luYygpOiBzdHJpbmdbXSB7XG4gIGlmICghbWlicyB8fCBtaWJzLmxlbmd0aCA9PT0gMCkge1xuICAgIG1pYnMgPSBmaWxlc1RvTWlicyhmcy5yZWFkZGlyU3luYyhtaWJzRGlyKSk7XG4gIH1cbiAgcmV0dXJuIG1pYnM7XG59XG4iXX0=