(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  var actual = that.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual)
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":3,"ieee754":4,"isarray":5}],3:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function placeHoldersCount (b64) {
  var len = b64.length
  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  return b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0
}

function byteLength (b64) {
  // base64 is 4/3 + up to two characters of the original data
  return b64.length * 3 / 4 - placeHoldersCount(b64)
}

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length
  placeHolders = placeHoldersCount(b64)

  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],4:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],5:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],7:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],9:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],10:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":9,"_process":7,"inherits":8}],11:[function(require,module,exports){
(function (Buffer){
/**
 * Entry point for Control Solutions Node.js package
 *
 * This file exposes the API for communicating with
 * CS's MODBUS Controller products.
 *
 */

'use strict';


// built-in node utility module
var util = require('util');

// Node event emitter module
var EventEmitter = require('events').EventEmitter;

// Include the MODBUS master
var Modbus = require('cs-modbus');

// Promise library
var BPromise = require('bluebird');

// Extra Buffer handling stuff
var buffers = require('h5.buffers');

// Register object definition
var Register = require('./lib/Register');


/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
function zeroPad( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
}

/**
 * Constructor: initializes the object and declares its public interface
 *
 * @param string name: the name of the port (as known to the operating system)
 * @param object config: optional object containing configuration parameters:
 */
function Port ( options ) {
  var me = this;

  // for debugging
  BPromise.longStackTraces();

  // Initialize the state of this object instance
  //me.name = name;

  // keep track of reconnection timers
  me.reconnectTimer = null;

  // Modbus object IDs for this device
  me.object = {
    FACTORY           : 0,
    USER              : 1,
    NET_STATUS        : 2,
    SCAN_RESULT       : 3,
    CONNECTION_TABLE  : 4,
    COORD_STATUS      : 5,

    SENSOR_DATA       : 7
  };


  me.commands = [
  '',
  'reset',
  'save',
  'restore',
  'pair',
  'clear',
  'sendconn',
  'sendshort',
  'sendlong',
  'broadcast',
  'scan',
  'ping'
  ];


  // Create the MODBUS master using the supplied options
  me.master = Modbus.createMaster( options.master );

  // Pass through the connected event from the master to our client
  me.master.on('connected', this.emit.bind(this, 'connected'));

  // Catch an event if the port gets disconnected
  me.master.on( 'disconnected', function() {

    // FYI - the port object drops all listeners when it disconnects
    // but after the disconnected event, so they haven't been dropped at
    // this point.

    me.emit( 'disconnected');

    // let the port finish disconnecting, then work on reconnecting
    //process.nextTick( function() { me.reconnect(); } );

  });
}

// This object can emit events.  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( Port, EventEmitter );

/**
 * Converts a 16-bit short address into a string like 'A1B2'
 * @param  {Buffer} buffer buffer containing the bytes to format
 * @param  {number} offset offset into the buffer to start reading
 * @return {string}        a string containing the 16-bit hex value
 */
Port.prototype.destroy = function() {

  // this causes an error about port not open; I think it gets cleaned 
  // up in master destroy anyway
  //this.port.close();
  this.master.destroy();

};

/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
Port.prototype.zeroPad = function( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
};


/**
 * Queries the MODBUS SlaveID
 *
 * @return {Promise} resolves when transaction is complete
 */
Port.prototype.readId = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    me.master.reportSlaveId({
      onComplete: function(err, response) {
        if( err ){
          reject( err );
        }
        else {
          var additional = response.getValues();
          
          // Read serial number and product ID if they exist
          var serial = 0;
          var productId = 0;

          if( additional.length >= 4 ) {
            serial = additional.readUInt32BE(0);
          }

          if( additional.length >= 8 ) {
            productId = additional.readUInt32BE(4); 
          }

          resolve( {
            id: response.product,            
            run: response.run,
            version: response.getVersion(),
            serialNumber: serial,
            productId: productId
            
          });
        }
      }
    });
  });

};



/**
 * Sends a command to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.command = function( cmd, data ) {

  var me = this;

  return new BPromise(function(resolve, reject){
    var id = me.commands.indexOf(cmd );

    me.master.command( id, data, {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/**
 * Sends a command to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.unlock = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    me.master.command( 255, new Buffer(0), {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/**
 * Writes multiple values to the slave
 *
 * @param {number} id command ID
 * @param {Buffer} data additional bytes to send
 *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.setRegisters = function( address, values ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var builder = new buffers.BufferBuilder();

    for( var i = 0; i < values.length; i++ ) {
      builder
        .pushUInt16( values[i] );
    }

    me.master.writeMultipleRegisters( address, builder.toBuffer(), {
      onComplete: function(err,response) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });
  });
};

/*
Controller.prototype.readMap = function( mapItem ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var list = buildRegisterList( mapItem );

    var todo = [];

    _.each( list, function( reg ) {
      todo.push( me.readRegister( reg ));
    });
    //console.log( 'list: ', list );

    BPromise.all( todo )
    .then( function( result ) {

      resolve( result);
    })
    .catch( function(err) {

      reject( err );
    });

  });
          
};
*/

/**
 * Recursively find registers in a register map object
 * 
 * @param  {[type]} mapItem [description]
 * @param {function} wrapFunc Function to wrap the register before it is appended to the list
 * @return {array}  array containing wrapped Register objects
 */
function buildRegisterList( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof( wrapFunc ) ) {
      result.push( wrapFunc( mapItem ));
    }
    else {
      result.push( mapItem );

    }

  }
  else if( 'object' === typeof( mapItem ) && !(mapItem instanceof Buffer)) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( buildRegisterList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
}

/**
 * Reads a register item from the slave
 *
 * @returns {Promise} that resolves when the read operation is complete
 */
Port.prototype.readRegister = function( reg ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var callback = {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          //console.log( 'resp: ', response );
          reg.setValue( response.values );

          resolve( reg );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    };

   if( reg.type === 'object') {
     me.master.readObject( reg.addr, callback );

    }
    else {
      
      //console.log( 'reading ' + reg.length + ' registers from 0x' + reg.addr.toString(16) );
      me.master.readHoldingRegisters( reg.addr, reg.length, callback );
    }

  });
  

};


/**
 * Writes a register item to the slave
 *
 * @returns {Promise} that resolves when the operation is complete
 */
Port.prototype.writeRegister = function( reg ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    var callback = {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          //console.log( reg.title + ' write result: ', response );
          resolve( reg );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    };

   if( reg.type === 'object') {
     me.master.writeObject( reg.addr, reg.value, callback );

    }
    else {
      
      //console.log( 'writing ' + reg.length + ' registers to 0x' + reg.addr.toString(16), 'buf: ', reg.toBuffer() );

      me.master.writeMultipleRegisters( reg.addr, reg.toBuffer(), callback );
    }

  });
  

};


/**
 * Reads registers from the slave
 *
 * @param {object} items
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.read = function( item ) {

  var me = this;

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.readRegister.bind(this) );

  //console.log( 'Reading ' +  list.length + ' registers');

  // if only one item, return a single promise (resolves to a Register)
  // If multiple registers, the promise resolves to an array of Registers
  // if no items to read, the promise rejects immediately
  if( list.length === 1 ) {
    return  list[0];
  }
  else if( list.length === 0 ) {
    return  BPromise.reject( 'No Registers to read');
  }
  else {
    return BPromise.all( list );
  }

};


/**
 * Writes registers to the slave
 *
 * @param {object} items
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.write = function( item ) {

  var me = this;

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.writeRegister.bind(this) );

  console.log( 'Writing ' +  list.length + ' registers');

  // if only one item, return a single promise (resolves to a Register)
  // If multiple registers, the promise resolves to an array of Registers
  // if no items to read, the promise rejects immediately
  if( list.length === 1 ) {
    return  list[0];
  }
  else if( list.length === 0 ) {
    return  BPromise.reject( 'No Registers to write');
  }
  else {
    return BPromise.all( list );
  }

};


/**
 * Read the entire controller configuration
 *
 * @returns Promise instance that resolves when command is completed
 */
 /*
Port.prototype.readConfig = function() {

  var me = this;

  var todo = [
    me.readHolding( BANK_EEPROM, 64 ),
    me.readHolding( BANK_EEPROM + 64, BANK_EEPROM_SIZE - 64 )
  ];

  // hold an array of promises, one for each device query
  var list = buildRegisterList( item, me.readRegister.bind(this) );

  console.log( 'Reading ' +  list.length + ' registers');

  return new BPromise(function(resolve, reject){

    BPromise.all( list )
    .then( function( result ) {

      resolve( result);
    })
    .catch( function(err) {

      reject( err );
    });

  });
};
*/

/**
 * Writes a Register item to the slave
 *
 * @param {object} item
 * @param {varies} value value to be written
  *
 * @returns Promise instance that resolves when command is completed
 */
/*
Port.prototype.write = function( item, value ) {

  var me = this;

  return new BPromise(function(resolve, reject){

    item.unformat( value );

    var t1 = me.master.writeMultipleRegisters( item.addr, item.toBuffer(), {
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( true );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });

  });
};
*/

/**
 * Resets the device
 *
 * @param {number} type
 * @param {number} duration enumeration indicating amount of time to dwell on each channel
  *
 * @returns Promise instance that resolves when command is completed
 */
Port.prototype.reset = function() {

  var me = this;

  return new BPromise(function(resolve, reject){

    var id = me.commands.indexOf('reset' );

    me.master.command( id, new Buffer(0), {
      timeout: 5000,
      onComplete: function(err, response ) {

        if( response && response.exceptionCode ) {
          // i'm not sure how to catch exception responses from the slave in a better way than this
          err = new Error( 'Exception ' + response.exceptionCode );
        }
        if( err ) {
          reject( err );
        }
        else {
          resolve( response.values[0] );
        }
      },
      onError: function( err ) {
        reject( err );
      }
    });

  });
};


/**
 * Returns an instance of the register map
 *
 * Caller can supply parameters to help choose the correct map
 * 
 * @param  {number} productId product type
 * 
 * @return {object} instance of a map containing Registers, or null if not found      
 */
Port.prototype.createMap = function( productId ) {

  var Map;

  switch( productId ){
    //case 0x11080000:
      //Map = require('./lib/map/cs1108_default');
     // break;

    //case 0x00000000:
    //case 0x81000000:
    //case 0x00001108:
    default:
      Map = require('./lib/map/cs8100_default');
      break;

    //default:
    //  return null;

  }

  return new Map();


};


/**
 * Public interface to this module
 *
 * The object constructor is available to our client
 *
 * @ignore
 */
module.exports = Port;


}).call(this,require("buffer").Buffer)
},{"./lib/Register":12,"./lib/map/cs8100_default":14,"bluebird":17,"buffer":2,"cs-modbus":74,"events":6,"h5.buffers":83,"util":10}],12:[function(require,module,exports){
(function (Buffer){
/**
 * Object that represents and manipulates a register
 *
 * This provides a convenient way to describe registers and convert their contents
 * to and from user-friendly interpretations.
 *
 */
'use strict';

var types = {
  'ee': {
    length: 1
  },

  'uint8': {
    length: 1
  },

  'uint16': {
    length: 1
  },

  'uintBE': {
    length: 2
  },

  'uint16LE': {
    length: 2
  },

  'uint32' : {
    length: 2
  },

  'object': {
    length: 1   // this is kinda arbitrary for an object; length varies
  },

  'holding': {
    length: 1   // this is kinda arbitrary for an object; length varies
  },

};


/**
 * Constructor for Register object
 *
 * @param {object} options the attributes of the register
 * @param {number} options.addr the address of the register (required)
 * @param {string} options.type the type of register: holding, input, object
 * @param {boolean} options.dirty whether the value has been changed but not saved
 * @param {number} options.length 
 * @param {function} options.fnFormat a custom formatting function( buffer, offset )
 * @param {function} options.fnUnformat a custom unformatting function( buffer, offset )
 * @param {function} options.fnValidate a custom validating function
 * @param {function} options.fromBuffer
 * @param {function} options.toBuffer
 * @param {string} options.title a friendly name of the register
 * @param {string} options.units indicates how the formatted value is represented
 * @param {number} options.writeAccess
 * @param {number} options.readAccess
 */
function Register( options ) {

  // Define access levels for registers.
  // Unrestricted = anybody can access it
  // OEM/Factory/Engineering = limited to authorized users
  // BLOCKED = nobody can access it.  Not sure if this is useful
  this.UNRESTRICTED = 0;
  this.OEM = 10;
  this.FACTORY = 20;
  this.ENGINEERING = 30;
  this.BLOCKED = 1000;


  // Store the options, using defaults where necessary
  this.addr = options.addr;
  this.type = options.type || 'holding';
  this.isDirty = options.dirty || false;
  this.length = options.length || types[this.type].length;

  this.fnFormat = options.format || null;
  this.fnUnformat = options.unformat || null;
  this.fnValidate = options.validate || null;
  this.fromBuffer = options.fromBuffer || this.fromBuffer;
  this.toBuffer = options.toBuffer || this.toBuffer;
  
  this.title = options.title || 'Reg: ' + this.addr;
  
  this.units = options.units || '';
  
  this.writeAccess = options.writeAccess || this.FACTORY;
  this.readAccess = options.readAccess || this.FACTORY;

  this.value = null;

}

/**
 * Sets the unformatted value of the register
 *
 * Does not perform validation
 *
 * @param value the new value of this register
 */
Register.prototype.setValue = function( value ) {
  
  this.value = value;

};

/**
 * Sets the value of the register from a formatted value
 *
 *
 * @param formatted the new value of this register
 */
Register.prototype.set = function( formatted ) {
  
  //console.log( 'Register::set ' + this.title + ' ', formatted, ' ', this.unformat( formatted ) );
  this.value = this.unformat( formatted );

};


/**
 * Sets the unformatted value of the register
 *
 * Does not perform validation
 *
 * @param value the new value of this register
 */
Register.prototype.toBuffer = function() {
  
  if( this.value instanceof Buffer ) {
    return this.value;
  }
  else {
    switch( typeof( this.value )) {
      case 'string':
      case 'number':
        return new Buffer( this.value );

      default:
        console.log( this.title + ' value type ' + typeof( this.value ));
        throw new Error( 'Register.toBuffer unknown type. You probably need a custom toBuffer function' );
    }
  
  }

};

/**
 * Returns the value of this register, formatted if possible
 *
 * @return value
 */
Register.prototype.format = function( buffer, offset ) {

  offset = offset || 0;
  buffer = buffer || this.value;

  if( this.fnFormat ) {
    return this.fnFormat( buffer, offset );
  }
  else {
    switch( this.type ) {
      case 'uint8':
        return buffer.readUInt8( offset );

      case 'uint16LE':
        return buffer.readUInt16LE( offset );

      case 'uint16BE':
        return buffer.readUInt16BE( offset );

      case 'buffer':
        return buffer;

      default:
        throw new Error( 'Tried to format unknown Register type' );
    }

    
  }

};


/**
 * Sets the value of the object, from the format()ted version
 *
 * @return {[type]} value
 */
Register.prototype.unformat = function( formatted, buffer, addr ) {

  if( this.fnUnformat ) {
    return this.fnUnformat( formatted, buffer, addr );

  }
  else {
        throw new Error( 'Tried to unformat unknown Register type' );
  }

};

/**
 * Validates a formatted value
 *
 * @return {boolean} true if the value is valid
 */
Register.prototype.validate = function( value ) {

  //console.log( 'Validating ' + value + ' : ' + this.min + ' : ' + this.max );
  
  if( this.fnValidate ) {
    return this.fnValidate( value );
  }
  else {
    return true;
  }

};


module.exports = Register;
}).call(this,require("buffer").Buffer)
},{"buffer":2}],13:[function(require,module,exports){
/**
 * Object that represents basic register map operations
 *
 * This object is probably never instantiated itself; rather it
 * is used as a 'base class' from which register maps are extended
 *
 * Copyright (c) 2017 Control Solutions LLC.  All Rights Reserved
 */
'use strict';

var Register = require('./Register');


function RegisterMap() {
 

}


/**
 * Recursively find registers in a register map object
 * 
 * @param  {[type]} mapItem [description]
 * @param {function} wrapFunc Function to wrap the register before it is appended to the list
 * @return {array}  array containing wrapped Register objects
 */
RegisterMap.prototype.buildList = function( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof(wrapFunc) ) {
      result.push( wrapFunc(mapItem));
    }
    else {
      result.push( mapItem );

    }

  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
};

/*
RegisterMap.prototype.newbuildList = function( mapItem, wrapFunc ) {

  var result = [];

  if( mapItem instanceof Register ) {

    if( 'function' === typeof(wrapFunc) ) {
      result.push( wrapFunc(mapItem));
    }
    else {
      result.push( mapItem );

    }

    // recurse any subregisters
    for (var prop in mapItem.sub ) {

      // if it's an explicit property 
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }


  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result = result.concat( this.buildList( mapItem[ prop ], wrapFunc ));
      }
    }

  }

  return result;
};
*/

RegisterMap.prototype.isDirty = function( register ) {

  // if register/object was not specified, check the whole map
  if( 'undefined' === typeof( register )) {
    register = this;
  }

  var list = this.buildList( register );

  var bDirty = false;

  if( Array.isArray( list ) ) {

    // check each register; if any are dirty return true
    list.forEach( function( e ) {
      console.log( e );
      if( e.isDirty ) {
        bDirty = true;
      }
    });
  }

  return bDirty;

};


// Takes a register object containing a buffer of bytes and sets 
// the map items
RegisterMap.prototype.fromRegister = function( register ) {

  //console.log( register );
  //console.log( 'RegisterMap.set ' + register.addr + ' len ' + register.length + ' bytes ' + register.value.length );

  var list = this.buildList( this );

  //console.log( list );

  list.forEach( function( item ) {
    //console.log( 'Register: ' + item.title );

    // set the value of registers that aren't myself, and have an address in my range
    if( item !== register && 
      register.addr <= item.addr && 
      (register.addr + register.length) >= (item.addr + item.length )) {

      //console.log( 'Setting '+ item.title );
      var startIndex = (item.addr-register.addr )*2;
      item.setValue( register.value.slice( startIndex, (startIndex + item.length*2 )) );
      
      //console.log( item );
    }
  });

};

// Retrieves the map item value as a Javascript object
RegisterMap.prototype.get = function( mapItem ) {

  var result;

  if( mapItem instanceof Register ) {

    result = mapItem.format();
   
  }
  else if( 'object' === typeof( mapItem )) {
    result = {};

    for (var prop in mapItem) {
      if( mapItem.hasOwnProperty( prop ) ) {
        result[prop] = this.get( mapItem[ prop ] );
      }
    }

  }

  return result;
};



// Recursively sets register values from a javascript object containing formatted values
// The object structure must match the map item structure else throw 
RegisterMap.prototype.set = function( mapItem, formatted  ) {

  var result;

  if( mapItem instanceof Register ) {

    mapItem.setValue( mapItem.unformat( formatted ));
   
  }
  else if( 'object' === typeof( mapItem )) {

    for (var prop in mapItem) {

      if( formatted.hasOwnProperty( prop )) {
        if( mapItem.hasOwnProperty( prop ) ) {

          this.set( mapItem[ prop ], formatted[prop] );

        }
      }
      else {
        throw new Error( 'No value supplied for ' + prop );
      }
    }

  }

  return result;
};


module.exports = RegisterMap;

  
},{"./Register":12}],14:[function(require,module,exports){
(function (Buffer){
/**
 * This module exports an object constructor that represents the memory map of a controller.
 *
 * The memory map is built by including various portions of the map
 * Usage:
 *  var map = require('./lib/map/cs8100_default.js')
 *
 *
 */
'use strict';

var util = require('util');

var RegisterMap = require('../RegisterMap');

var Register = require('../Register');

var helpers = require('./helpers');

var buffers = require('h5.buffers');



var throttleConfig = require( './cs8100_throttle');


// Memory bank definitions (match those embedded in the controller)
var BANK_RAM    = 0x0000;
var BANK_HRAM   = 0x0100;
var BANK_EEPROM  = 0x0300;

/*
// Memory bank sizes (in 16-bit words; matches definitions in controller)
var BANK_RAM0_SIZE    = 0x30 / 2;
var BANK_RAM1_SIZE    = 0x50 / 2;
var BANK_RAM2_SIZE    = 0x40 / 2;
var BANK_EEPROM_SIZE  = 0xFF / 2;


// Size of each of the memory banks.  These match constants in the 
// controller code
var BRAIN_RAM0_SIZE  = 0x30;
var BRAIN_RAM1_SIZE  = 0x50;
var BRAIN_RAM2_SIZE  = 0x40;
var BRAIN_EEPROM_SIZE  = 0xFF;

*/




var portBFlagBits = 
[
  'key',         
  'charging',   
  'bit2',     
  'bit3',         
  'bit4',               
  'indoor',              
  'bit6',         
  'bit7'
];

var portCFlagBits = 
[
  'reverse',         
  'bit1',   
  'bit2',     
  'bit3',         
  'bit4',               
  'bit5',      
  'quickstop', 
  'brakeRelease'
];


function convertThrottleToVolts( msb, lsb ) {
  var volts = msb * 256 + lsb;

  return  5.0 * volts / ( 255.0 * 256 );

}

function convertTempToDegrees( msb, lsb ) {
  var temp = msb - 0x6C;

  temp = temp + (lsb / 255 );

  return temp;

}


function convertBatteryToVolts( msb, lsb ) {
  var volts = msb * 256 + lsb;

      volts = volts * 1469.0;
      volts = volts / 3.0;
      volts = volts / 16777216.0;
      volts = volts * 24;
  return volts;
}


function convertCurrentToAmps( msb, lsb ) {

           // Take the 16-bit value
      var current = msb * 256 + lsb;

      // divide by a magic number to get floating point amps
      var amps = (current / 0x69);

      // if the ram value has the lower bit set, negate the current
      if( 0 === current & 0x0001 ) {
        amps = -amps;
      }

      return amps;
  
}

function NextGenDefaultMap() {
  
 
  // base class constructor
  RegisterMap.call( this );

  // keep a reference we can use to access this object
  var map = this;

  // Defines all the configuration items
  this.config = {

    throttle: {
      deadband: new Register( Object.assign( throttleConfig.deadband, { addr: BANK_EEPROM + 0x19 })),
      failband: new Register( Object.assign( throttleConfig.failband, { addr: BANK_EEPROM + 0x1B })),
      scale: new Register( Object.assign( throttleConfig.scale, { addr: BANK_EEPROM + 0x1D })),
      flags: new Register( Object.assign( throttleConfig.flags, { addr: BANK_EEPROM + 0x1F })),
      uflags: new Register( Object.assign( throttleConfig.uflags, { addr: BANK_EEPROM + 0x57 })),
   
    },


  };

  // Defines the RAM versions of the configuration items
  this.ramConfig = {

    throttle: {
      deadband: new Register( Object.assign( throttleConfig.deadband, { addr: BANK_RAM + 0xB9 })),
      failband: new Register( Object.assign( throttleConfig.failband, { addr: BANK_RAM+ 0xBB })),
      scale: new Register( Object.assign( throttleConfig.scale, { addr: BANK_RAM + 0xBD })),
      flags: new Register( Object.assign( throttleConfig.flags, { addr: BANK_RAM + 0xBF })),
      uflags: new Register( Object.assign( throttleConfig.uflags, { addr: BANK_HRAM + 0x97 })),
   
    },

  };

  // Defines the raw register blocks that contain eeprom settings.  These can
  // be used to efficiently read or write blocks of configuration (without
  // individually reading or writing each register)
  this.eeprom = {
    block1: new Register( { type: 'holding', addr: BANK_EEPROM + 0, length: 0x50 } ),
    block2: new Register( { type: 'holding', addr: BANK_EEPROM + 0x50, length: 0x20 } ),
    block3: new Register( { type: 'holding', addr: BANK_EEPROM + 0x80, length: 0x20 } ),
  };


  this.decodeStatusBuffer = function( buffer ) {

    // Create a buffer reader object
    var reader = new buffers.BufferReader( buffer );

    return {
      portB: helpers.wordToFlags( reader.shiftByte(), portBFlagBits ),
      portC: helpers.wordToFlags( reader.shiftByte(), portCFlagBits ),
      pwm: helpers.byteToPercent( reader.shiftByte() ),
      throttle: helpers.byteToPercent( reader.shiftByte() ),
      throttleV: convertThrottleToVolts( reader.shiftByte(), reader.shiftByte() ),
      current: convertCurrentToAmps( reader.shiftByte(), reader.shiftByte() ),
      temperature: convertTempToDegrees( reader.shiftByte(), reader.shiftByte() ),
      batteryVolts: convertBatteryToVolts( reader.shiftByte(), reader.shiftByte() )

    };
  };


  this.targetPortB = new Register( { 
    title: 'Port B',
    type: 'holding', 
    addr: BANK_RAM + 0x06,

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), portBFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, portBFlagBits ), 0 );

      return buf;
    },


  });

  this.targetPortC = new Register( { 
    title: 'Port C',
    type: 'holding', 
    addr: BANK_RAM + 0x07,

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), portCFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, portCFlagBits ), 0 );

      return buf;
    },


  });

}


// Inherit basic map properties  Note, the inherits
// call needs to be before .prototype. additions for some reason
util.inherits( NextGenDefaultMap, RegisterMap );


module.exports = NextGenDefaultMap;

  
}).call(this,require("buffer").Buffer)
},{"../Register":12,"../RegisterMap":13,"./cs8100_throttle":15,"./helpers":16,"buffer":2,"h5.buffers":83,"util":10}],15:[function(require,module,exports){
(function (Buffer){
/**
 * This module exports an object that represents the memory map of a controller.
 *
 * The memory map is built by including various portions of the map
 * Usage:
 *  var map = require('./lib/maps/nextgen_default.js')
 *
 *
 */
'use strict';

var util = require('util');

var Register = require('../Register');

var buffers = require('h5.buffers');

var helpers = require('./helpers');




var throttleFlagBits2 = 
[
  'frontDriveIn',           // BIT 00 set for front drive mode in indoor mode
  'throttleLimitedBoost',   // BIT 01 set for boost limited by throt position
  'accelLimitedBoost',      // BIT 02 set for boost limited by accel
  'mcalFromStposh',         // BIT 03 set for mcal taken from st_posh
  'feedback',               // BIT 04 set when feedback present for going straight fwd
  'softDecel',              // BIT 05 set for no neg boost
  'frontDriveOut',          // BIT 06 set for front drive mode in outdoor mode
  'noEmBrake',              // BIT 07 set for no embrake
];

var throttleFlagBits = 
[
  'throttleInvert',         // BIT 08 invert polarity of throttle when set
  'throttleInvert2',        // BIT 09 invert polarity of throttle 2 when set  
  'aninThrottle',           // BIT 10 set for anin used for max speed
  'aninThrottle2',          // BIT 11 set for anin used for max steer
  'maxSpeedThrottle',       // BIT 12 set for maxspd used for max speed
  'maxSpeedThrottle2',      // BIT 13 set for maxspd used for max steer
  'ultapotThrottle',        // BIT 14 set for ultapot used for max speed
  'ultapotThrottle2'        // BIT 15  set for ultapot used for max steer
];

var uthrottleFlagBits = 
[
  'serialThrottle', 
  'analogThrottle', 
  'serialThtThrottle', 
  'invertSerialThrottle'
];

/**
 * Decode the throttle flags into a 16-bit word
 */
 /*
function wordToFlags( word ){

  return {
    frontDriveIn:   (word & 0x0001) > 0,    // set for front drive mode in indoor mode
    throttleLimitedBoost:    (word & 0x0002) > 0,    // set for boost limited by throt position
    accelLimitedBoost:    (word & 0x0004) > 0,    // set for boost limited by accel
    mcalFromStposh: (word & 0x0008) > 0,        // set for mcal taken from st_posh
    feedback: (word & 0x0010) > 0,           // set when feedback present for going straight fwd
    softDecel: (word & 0x0020) > 0,        // set for no neg boost
    frontDriveOut: (word & 0x0040) > 0,     // set for front drive mode in outdoor mode
    noEmBrake: (word & 0x0080) > 0,        // set for no embrake
    throttleInvert: (word & 0x0100) > 0,        // invert polarity of throttle when set
    throttleInvert2: (word & 0x0200) > 0,       // invert polarity of throttle 2 when set    
    aninThrottle: (word & 0x0400) > 0,        // set for anin used for max speed
    aninThrottle2: (word & 0x0800) > 0,       // set for anin used for max steer
    maxSpeedThrottle: (word & 0x1000) > 0,      // set for maxspd used for max speed
    maxSpeedThrottle2: (word & 0x2000) > 0,     // set for maxspd used for max steer
    ultapotThrottle: (word & 0x4000) > 0,     // set for ultapot used for max speed
    ultapotThrottle2: (word & 0x8000) > 0,    // set for ultapot used for max steer
  };
}



  // throttle failband
  // 1B  fl_band     ;throttle failband value, default s/b 3.2V
  // 1C  fl_band2    ; = high byte of hex[(desired V - 2.5)/5*4096*16*2]
  //                 ; For unidirection throttle,
  //                 ; = high byte of hex[(desired V)/5*4096*16]
  this.failband = new Register({
    title: 'Failband',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',
    units: '%',
    min: 0,
    max: 100,

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {
      return buffer.readUInt16LE( addr );
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {
        
      // validate the value
      this.validate( value );

      // value is a percentage; scale to word
      var word = value * 655.35;

      // save to the buffer
      buffer.writeUInt16LE( word, addr );
    },

  });
  

  // Throttle Scale
  // 1D   thrtscl    ;throttle scaling value, determines where full speed ;occurs
  // 1E   thrt2scl   ; For bidi throt = 0xff/[(desired V - deadband ;V)/5*4096*16*2]
  //                 ; For unidirection throttle,
  //                 ; = 0xff/[(desired V - deadband V)/5*4096*16]

  this.thrtscl = new Register({
    title: 'Throttle Scale',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint16LE',
    units: '%',
    min: 0,
    max: 100,

  });

  // Throttle flags
  // 1F   tht_flgs   ;throttle flags.  See bit definitions below:
  //         tht_invert      tht_flgs,0      ;invert polarity of throttle ;when set
  //         tht2_invert     tht_flgs,1      ;invert polarity of throttle 2 ;when set
  //         anin_throt      tht_flgs,2      ;set for anin used for max ;speed
  //         anin_throt2     tht_flgs,3      ;set for anin used for max ;steer
  //         maxspd_throt    tht_flgs,4      ;set for maxspd used for max ;speed
  //         maxspd_throt2   tht_flgs,5      ;set for maxspd used for max ;steer
  //         ultapot_throt   tht_flgs,6      ;set for ultapot used for max ;speed
  //         ultapot_throt2  tht_flgs,7      ;set for ultapot used for max ;steer
  this.thrtFlags = new Register({
    title: 'Throttle Flags',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'uint8',

    // Convert raw value into user-friendly version
    format: function( buffer, addr ) {

      var value = buffer.readUInt8( addr );

      return {
        invert: (value & 0x01) > 0,
        anin: (value & 0x04) > 0,
        maxSpeed: (value & 0x10) > 0,
      };
    },

    // Convert user friendly value into raw value and store in buffer
    unformat: function( value, buffer, addr ) {

      // validate the value
      this.validate( value );

      var byte = 0;

      if( value.invert ) {
        byte |= 0x01;
      }
      if( value.anin ) {
        byte |= 0x04;
      }
      if( value.maxSpeed ) {
        byte |= 0x10;
      }

      // save to the buffer
      buffer.writeUInt8( byte, addr );
    },

  });


  // Throttle settings
  // Combination of throttle-related registers
  this.throttle = new Register({
    title: 'Throttle',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    eeAddr: 0x19,
    length: 7,
    format: function( buffer, addr ) {
      return {
        deadband: map.deadband.format( buffer, addr ),
        failband: map.failband.format( buffer, addr ),
        scale: map.thrtscl.format( buffer, addr ),
        flags: map.thrtFlags.format( buffer, addr )

      };
    },
  });

  this.uThrottle = new Register({
    title: 'UThrottle',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    eeAddr: 0x57,

    format: function( buffer, addr ) {

      var value = buffer.readUInt8( addr );

      return {
        serial: (value & 0x01) > 0,
        analog: (value & 0x02) > 0,
        serialTht: (value & 0x04) > 0,
        invertSerial: (value & 0x08) > 0,
      };
    },
  });

*/


module.exports = {

  deadband: {
    title: 'Deadband',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'holding',

    format: function( buffer, offset ) {
      
      return Math.round( buffer.readUInt16BE( offset )*100/255);
    },

    unformat: function( value ) {

     var buf = new Buffer(2);

      buf.writeUInt16BE( Math.round( value * 2.55), 0 );

      
      return buf;
    },

  },

  failband: {
    title: 'Failband',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'holding',

    format: function( buffer, offset ) {
      
      return parseInt( buffer.readUInt16BE( offset )*100/255);
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( parseInt( value * 2.55), 0 );

      return buf;
    },
  },

  scale: {
    title: 'Scale',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'holding',

    format: function( buffer, offset ) {
      
      return parseInt( buffer.readUInt16BE( offset )*100/255);
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( parseInt( value * 2.55), 0 );

      return buf;
    },

  },

  flags: {
    title: 'Flags',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'holding',

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), throttleFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, throttleFlagBits ), 0 );

      return buf;
    },

  },

  uflags: {
    title: 'UFlags',
    writeAccess: Register.UNRESTRICTED,
    readAccess: Register.UNRESTRICTED,
    type: 'holding',

    format: function( buffer, offset ) {
      return helpers.wordToFlags( buffer.readUInt16BE( offset ), uthrottleFlagBits );
    },

    unformat: function( value ) {

      var buf = new Buffer(2);

      buf.writeUInt16BE( helpers.flagsToWord( value, uthrottleFlagBits ), 0 );

      return buf;
    },

  },

};




/*


module.exports = {

  title: 'Throttle Config',
  writeAccess: Register.UNRESTRICTED,
  readAccess: Register.UNRESTRICTED,

  // Convert raw value into user-friendly version
  format: function( buffer, offset ) {

    return {
      deadband: parseInt( buffer.readUInt16LE( offset ) / 655.35),
      failband: parseInt( buffer.readUInt16LE( offset+2 ) / 655.35),
      scale: parseInt( buffer.readUInt16LE( offset+4 ) / 655.35),
      flags: helpers.wordToFlags( buffer.readUInt16LE( offset+6 ), throttleFlagBits )
      
    }; 
  },

  // Convert user friendly values into raw values in a buffer
  unformat: function( value ) {
      
    // validate the value

    var flags = 0;

    // Initialize a buffer
    var builder = new buffers.BufferBuilder();

    builder
      .pushUInt16( parseInt( value.deadband * 655.35 ))
      .pushUInt16( parseInt( value.failband * 655.35 ))
      .pushUInt16( parseInt( value.scale * 655.35))
      .pushUInt16( helpers.flagsToWord( value.flags, throttleFlagBits ) );
 
    return builder.toBuffer();    

  },

};
*/

}).call(this,require("buffer").Buffer)
},{"../Register":12,"./helpers":16,"buffer":2,"h5.buffers":83,"util":10}],16:[function(require,module,exports){
(function (Buffer){
'use strict';

module.exports = {



 /**
  * @private
  * @param {Array.<number>} byteArray
  * @param {number} bitCount
  * @returns {Array.<boolean>}
  */
  bytesToBits : function(byteArray, bitCount) {
    var bitArray = [];
    var byteCount = byteArray.length;

    for (var byteIndex = 0; byteIndex < byteCount; ++byteIndex)
    {
      var byteValue = byteArray[byteIndex];

      for (var bitIndex = 0; bitIndex < 8; ++bitIndex)
      {
        if (bitArray.length === bitCount)
        {
          break;
        }

        bitArray.push(Boolean(byteValue & Math.pow(2, bitIndex)));
      }
    }

    return bitArray;
  },


  wordToFlags: function( word, map ) {

    var flags = {};

    var bit = 1;

    for( var i = 0; i < map.length; i++ ) {

      flags[ map[i] ] = ( word & bit ) > 0;

      bit <<= 1;
    }

    return flags;
  
  },

  flagsToWord: function( flags, map ) {

    var word = 0;

    map.forEach( function( val, index ) {

      if( flags[val] ){
        word |= ( 1 << index );
      }
    });

    return word;
  
  },

  uint16BEtoPercent: function( buffer, offset ) {
    return parseInt( buffer.readUInt16BE( offset ) / 655.35);
  },


  percentToUint16BE: function( value ) {

    var buf = new Buffer( 2 );

    buf.writeUInt16BE( Math.round( value * 655.35 ), 0 );

    return buf;
  },

  byteToPercent: function( byte ) {
    return Math.round( byte / 2.55 );
  }



};


}).call(this,require("buffer").Buffer)
},{"buffer":2}],17:[function(require,module,exports){
(function (process,global){
/* @preserve
 * The MIT License (MIT)
 * 
 * Copyright (c) 2013-2015 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
/**
 * bluebird build version 3.4.6
 * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, using, timers, filter, any, each
*/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof _dereq_=="function"&&_dereq_;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof _dereq_=="function"&&_dereq_;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var SomePromiseArray = Promise._SomePromiseArray;
function any(promises) {
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function (promises) {
    return any(promises);
};

Promise.prototype.any = function () {
    return any(this);
};

};

},{}],2:[function(_dereq_,module,exports){
"use strict";
var firstLineError;
try {throw new Error(); } catch (e) {firstLineError = e;}
var schedule = _dereq_("./schedule");
var Queue = _dereq_("./queue");
var util = _dereq_("./util");

function Async() {
    this._customScheduler = false;
    this._isTickUsed = false;
    this._lateQueue = new Queue(16);
    this._normalQueue = new Queue(16);
    this._haveDrainedQueues = false;
    this._trampolineEnabled = true;
    var self = this;
    this.drainQueues = function () {
        self._drainQueues();
    };
    this._schedule = schedule;
}

Async.prototype.setScheduler = function(fn) {
    var prev = this._schedule;
    this._schedule = fn;
    this._customScheduler = true;
    return prev;
};

Async.prototype.hasCustomScheduler = function() {
    return this._customScheduler;
};

Async.prototype.enableTrampoline = function() {
    this._trampolineEnabled = true;
};

Async.prototype.disableTrampolineIfNecessary = function() {
    if (util.hasDevTools) {
        this._trampolineEnabled = false;
    }
};

Async.prototype.haveItemsQueued = function () {
    return this._isTickUsed || this._haveDrainedQueues;
};


Async.prototype.fatalError = function(e, isNode) {
    if (isNode) {
        process.stderr.write("Fatal " + (e instanceof Error ? e.stack : e) +
            "\n");
        process.exit(2);
    } else {
        this.throwLater(e);
    }
};

Async.prototype.throwLater = function(fn, arg) {
    if (arguments.length === 1) {
        arg = fn;
        fn = function () { throw arg; };
    }
    if (typeof setTimeout !== "undefined") {
        setTimeout(function() {
            fn(arg);
        }, 0);
    } else try {
        this._schedule(function() {
            fn(arg);
        });
    } catch (e) {
        throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
};

function AsyncInvokeLater(fn, receiver, arg) {
    this._lateQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncInvoke(fn, receiver, arg) {
    this._normalQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncSettlePromises(promise) {
    this._normalQueue._pushOne(promise);
    this._queueTick();
}

if (!util.hasDevTools) {
    Async.prototype.invokeLater = AsyncInvokeLater;
    Async.prototype.invoke = AsyncInvoke;
    Async.prototype.settlePromises = AsyncSettlePromises;
} else {
    Async.prototype.invokeLater = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvokeLater.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                setTimeout(function() {
                    fn.call(receiver, arg);
                }, 100);
            });
        }
    };

    Async.prototype.invoke = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvoke.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                fn.call(receiver, arg);
            });
        }
    };

    Async.prototype.settlePromises = function(promise) {
        if (this._trampolineEnabled) {
            AsyncSettlePromises.call(this, promise);
        } else {
            this._schedule(function() {
                promise._settlePromises();
            });
        }
    };
}

Async.prototype.invokeFirst = function (fn, receiver, arg) {
    this._normalQueue.unshift(fn, receiver, arg);
    this._queueTick();
};

Async.prototype._drainQueue = function(queue) {
    while (queue.length() > 0) {
        var fn = queue.shift();
        if (typeof fn !== "function") {
            fn._settlePromises();
            continue;
        }
        var receiver = queue.shift();
        var arg = queue.shift();
        fn.call(receiver, arg);
    }
};

Async.prototype._drainQueues = function () {
    this._drainQueue(this._normalQueue);
    this._reset();
    this._haveDrainedQueues = true;
    this._drainQueue(this._lateQueue);
};

Async.prototype._queueTick = function () {
    if (!this._isTickUsed) {
        this._isTickUsed = true;
        this._schedule(this.drainQueues);
    }
};

Async.prototype._reset = function () {
    this._isTickUsed = false;
};

module.exports = Async;
module.exports.firstLineError = firstLineError;

},{"./queue":26,"./schedule":29,"./util":36}],3:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise, debug) {
var calledBind = false;
var rejectThis = function(_, e) {
    this._reject(e);
};

var targetRejected = function(e, context) {
    context.promiseRejectionQueued = true;
    context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
};

var bindingResolved = function(thisArg, context) {
    if (((this._bitField & 50397184) === 0)) {
        this._resolveCallback(context.target);
    }
};

var bindingRejected = function(e, context) {
    if (!context.promiseRejectionQueued) this._reject(e);
};

Promise.prototype.bind = function (thisArg) {
    if (!calledBind) {
        calledBind = true;
        Promise.prototype._propagateFrom = debug.propagateFromFunction();
        Promise.prototype._boundValue = debug.boundValueFunction();
    }
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 1);
    var target = this._target();
    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        var context = {
            promiseRejectionQueued: false,
            promise: ret,
            target: target,
            bindingPromise: maybePromise
        };
        target._then(INTERNAL, targetRejected, undefined, ret, context);
        maybePromise._then(
            bindingResolved, bindingRejected, undefined, ret, context);
        ret._setOnCancel(maybePromise);
    } else {
        ret._resolveCallback(target);
    }
    return ret;
};

Promise.prototype._setBoundTo = function (obj) {
    if (obj !== undefined) {
        this._bitField = this._bitField | 2097152;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~2097152);
    }
};

Promise.prototype._isBound = function () {
    return (this._bitField & 2097152) === 2097152;
};

Promise.bind = function (thisArg, value) {
    return Promise.resolve(value).bind(thisArg);
};
};

},{}],4:[function(_dereq_,module,exports){
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict() {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
var bluebird = _dereq_("./promise")();
bluebird.noConflict = noConflict;
module.exports = bluebird;

},{"./promise":22}],5:[function(_dereq_,module,exports){
"use strict";
var cr = Object.create;
if (cr) {
    var callerCache = cr(null);
    var getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
}

module.exports = function(Promise) {
var util = _dereq_("./util");
var canEvaluate = util.canEvaluate;
var isIdentifier = util.isIdentifier;

var getMethodCaller;
var getGetter;
if (!true) {
var makeMethodCaller = function (methodName) {
    return new Function("ensureMethod", "                                    \n\
        return function(obj) {                                               \n\
            'use strict'                                                     \n\
            var len = this.length;                                           \n\
            ensureMethod(obj, 'methodName');                                 \n\
            switch(len) {                                                    \n\
                case 1: return obj.methodName(this[0]);                      \n\
                case 2: return obj.methodName(this[0], this[1]);             \n\
                case 3: return obj.methodName(this[0], this[1], this[2]);    \n\
                case 0: return obj.methodName();                             \n\
                default:                                                     \n\
                    return obj.methodName.apply(obj, this);                  \n\
            }                                                                \n\
        };                                                                   \n\
        ".replace(/methodName/g, methodName))(ensureMethod);
};

var makeGetter = function (propertyName) {
    return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
};

var getCompiled = function(name, compiler, cache) {
    var ret = cache[name];
    if (typeof ret !== "function") {
        if (!isIdentifier(name)) {
            return null;
        }
        ret = compiler(name);
        cache[name] = ret;
        cache[" size"]++;
        if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0; i < 256; ++i) delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
        }
    }
    return ret;
};

getMethodCaller = function(name) {
    return getCompiled(name, makeMethodCaller, callerCache);
};

getGetter = function(name) {
    return getCompiled(name, makeGetter, getterCache);
};
}

function ensureMethod(obj, methodName) {
    var fn;
    if (obj != null) fn = obj[methodName];
    if (typeof fn !== "function") {
        var message = "Object " + util.classString(obj) + " has no method '" +
            util.toString(methodName) + "'";
        throw new Promise.TypeError(message);
    }
    return fn;
}

function caller(obj) {
    var methodName = this.pop();
    var fn = ensureMethod(obj, methodName);
    return fn.apply(obj, this);
}
Promise.prototype.call = function (methodName) {
    var args = [].slice.call(arguments, 1);;
    if (!true) {
        if (canEvaluate) {
            var maybeCaller = getMethodCaller(methodName);
            if (maybeCaller !== null) {
                return this._then(
                    maybeCaller, undefined, undefined, args, undefined);
            }
        }
    }
    args.push(methodName);
    return this._then(caller, undefined, undefined, args, undefined);
};

function namedGetter(obj) {
    return obj[this];
}
function indexedGetter(obj) {
    var index = +this;
    if (index < 0) index = Math.max(0, index + obj.length);
    return obj[index];
}
Promise.prototype.get = function (propertyName) {
    var isIndex = (typeof propertyName === "number");
    var getter;
    if (!isIndex) {
        if (canEvaluate) {
            var maybeGetter = getGetter(propertyName);
            getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
            getter = namedGetter;
        }
    } else {
        getter = indexedGetter;
    }
    return this._then(getter, undefined, undefined, propertyName, undefined);
};
};

},{"./util":36}],6:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, PromiseArray, apiRejection, debug) {
var util = _dereq_("./util");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var async = Promise._async;

Promise.prototype["break"] = Promise.prototype.cancel = function() {
    if (!debug.cancellation()) return this._warn("cancellation is disabled");

    var promise = this;
    var child = promise;
    while (promise._isCancellable()) {
        if (!promise._cancelBy(child)) {
            if (child._isFollowing()) {
                child._followee().cancel();
            } else {
                child._cancelBranched();
            }
            break;
        }

        var parent = promise._cancellationParent;
        if (parent == null || !parent._isCancellable()) {
            if (promise._isFollowing()) {
                promise._followee().cancel();
            } else {
                promise._cancelBranched();
            }
            break;
        } else {
            if (promise._isFollowing()) promise._followee().cancel();
            promise._setWillBeCancelled();
            child = promise;
            promise = parent;
        }
    }
};

Promise.prototype._branchHasCancelled = function() {
    this._branchesRemainingToCancel--;
};

Promise.prototype._enoughBranchesHaveCancelled = function() {
    return this._branchesRemainingToCancel === undefined ||
           this._branchesRemainingToCancel <= 0;
};

Promise.prototype._cancelBy = function(canceller) {
    if (canceller === this) {
        this._branchesRemainingToCancel = 0;
        this._invokeOnCancel();
        return true;
    } else {
        this._branchHasCancelled();
        if (this._enoughBranchesHaveCancelled()) {
            this._invokeOnCancel();
            return true;
        }
    }
    return false;
};

Promise.prototype._cancelBranched = function() {
    if (this._enoughBranchesHaveCancelled()) {
        this._cancel();
    }
};

Promise.prototype._cancel = function() {
    if (!this._isCancellable()) return;
    this._setCancelled();
    async.invoke(this._cancelPromises, this, undefined);
};

Promise.prototype._cancelPromises = function() {
    if (this._length() > 0) this._settlePromises();
};

Promise.prototype._unsetOnCancel = function() {
    this._onCancelField = undefined;
};

Promise.prototype._isCancellable = function() {
    return this.isPending() && !this._isCancelled();
};

Promise.prototype.isCancellable = function() {
    return this.isPending() && !this.isCancelled();
};

Promise.prototype._doInvokeOnCancel = function(onCancelCallback, internalOnly) {
    if (util.isArray(onCancelCallback)) {
        for (var i = 0; i < onCancelCallback.length; ++i) {
            this._doInvokeOnCancel(onCancelCallback[i], internalOnly);
        }
    } else if (onCancelCallback !== undefined) {
        if (typeof onCancelCallback === "function") {
            if (!internalOnly) {
                var e = tryCatch(onCancelCallback).call(this._boundValue());
                if (e === errorObj) {
                    this._attachExtraTrace(e.e);
                    async.throwLater(e.e);
                }
            }
        } else {
            onCancelCallback._resultCancelled(this);
        }
    }
};

Promise.prototype._invokeOnCancel = function() {
    var onCancelCallback = this._onCancel();
    this._unsetOnCancel();
    async.invoke(this._doInvokeOnCancel, this, onCancelCallback);
};

Promise.prototype._invokeInternalOnCancel = function() {
    if (this._isCancellable()) {
        this._doInvokeOnCancel(this._onCancel(), true);
        this._unsetOnCancel();
    }
};

Promise.prototype._resultCancelled = function() {
    this.cancel();
};

};

},{"./util":36}],7:[function(_dereq_,module,exports){
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util");
var getKeys = _dereq_("./es5").keys;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

function catchFilter(instances, cb, promise) {
    return function(e) {
        var boundTo = promise._boundValue();
        predicateLoop: for (var i = 0; i < instances.length; ++i) {
            var item = instances[i];

            if (item === Error ||
                (item != null && item.prototype instanceof Error)) {
                if (e instanceof item) {
                    return tryCatch(cb).call(boundTo, e);
                }
            } else if (typeof item === "function") {
                var matchesPredicate = tryCatch(item).call(boundTo, e);
                if (matchesPredicate === errorObj) {
                    return matchesPredicate;
                } else if (matchesPredicate) {
                    return tryCatch(cb).call(boundTo, e);
                }
            } else if (util.isObject(e)) {
                var keys = getKeys(item);
                for (var j = 0; j < keys.length; ++j) {
                    var key = keys[j];
                    if (item[key] != e[key]) {
                        continue predicateLoop;
                    }
                }
                return tryCatch(cb).call(boundTo, e);
            }
        }
        return NEXT_FILTER;
    };
}

return catchFilter;
};

},{"./es5":13,"./util":36}],8:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var longStackTraces = false;
var contextStack = [];

Promise.prototype._promiseCreated = function() {};
Promise.prototype._pushContext = function() {};
Promise.prototype._popContext = function() {return null;};
Promise._peekContext = Promise.prototype._peekContext = function() {};

function Context() {
    this._trace = new Context.CapturedTrace(peekContext());
}
Context.prototype._pushContext = function () {
    if (this._trace !== undefined) {
        this._trace._promiseCreated = null;
        contextStack.push(this._trace);
    }
};

Context.prototype._popContext = function () {
    if (this._trace !== undefined) {
        var trace = contextStack.pop();
        var ret = trace._promiseCreated;
        trace._promiseCreated = null;
        return ret;
    }
    return null;
};

function createContext() {
    if (longStackTraces) return new Context();
}

function peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return undefined;
}
Context.CapturedTrace = null;
Context.create = createContext;
Context.deactivateLongStackTraces = function() {};
Context.activateLongStackTraces = function() {
    var Promise_pushContext = Promise.prototype._pushContext;
    var Promise_popContext = Promise.prototype._popContext;
    var Promise_PeekContext = Promise._peekContext;
    var Promise_peekContext = Promise.prototype._peekContext;
    var Promise_promiseCreated = Promise.prototype._promiseCreated;
    Context.deactivateLongStackTraces = function() {
        Promise.prototype._pushContext = Promise_pushContext;
        Promise.prototype._popContext = Promise_popContext;
        Promise._peekContext = Promise_PeekContext;
        Promise.prototype._peekContext = Promise_peekContext;
        Promise.prototype._promiseCreated = Promise_promiseCreated;
        longStackTraces = false;
    };
    longStackTraces = true;
    Promise.prototype._pushContext = Context.prototype._pushContext;
    Promise.prototype._popContext = Context.prototype._popContext;
    Promise._peekContext = Promise.prototype._peekContext = peekContext;
    Promise.prototype._promiseCreated = function() {
        var ctx = this._peekContext();
        if (ctx && ctx._promiseCreated == null) ctx._promiseCreated = this;
    };
};
return Context;
};

},{}],9:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, Context) {
var getDomain = Promise._getDomain;
var async = Promise._async;
var Warning = _dereq_("./errors").Warning;
var util = _dereq_("./util");
var canAttachTrace = util.canAttachTrace;
var unhandledRejectionHandled;
var possiblyUnhandledRejection;
var bluebirdFramePattern =
    /[\\\/]bluebird[\\\/]js[\\\/](release|debug|instrumented)/;
var nodeFramePattern = /\((?:timers\.js):\d+:\d+\)/;
var parseLinePattern = /[\/<\(](.+?):(\d+):(\d+)\)?\s*$/;
var stackFramePattern = null;
var formatStack = null;
var indentStackFrames = false;
var printWarning;
var debugging = !!(util.env("BLUEBIRD_DEBUG") != 0 &&
                        (true ||
                         util.env("BLUEBIRD_DEBUG") ||
                         util.env("NODE_ENV") === "development"));

var warnings = !!(util.env("BLUEBIRD_WARNINGS") != 0 &&
    (debugging || util.env("BLUEBIRD_WARNINGS")));

var longStackTraces = !!(util.env("BLUEBIRD_LONG_STACK_TRACES") != 0 &&
    (debugging || util.env("BLUEBIRD_LONG_STACK_TRACES")));

var wForgottenReturn = util.env("BLUEBIRD_W_FORGOTTEN_RETURN") != 0 &&
    (warnings || !!util.env("BLUEBIRD_W_FORGOTTEN_RETURN"));

Promise.prototype.suppressUnhandledRejections = function() {
    var target = this._target();
    target._bitField = ((target._bitField & (~1048576)) |
                      524288);
};

Promise.prototype._ensurePossibleRejectionHandled = function () {
    if ((this._bitField & 524288) !== 0) return;
    this._setRejectionIsUnhandled();
    async.invokeLater(this._notifyUnhandledRejection, this, undefined);
};

Promise.prototype._notifyUnhandledRejectionIsHandled = function () {
    fireRejectionEvent("rejectionHandled",
                                  unhandledRejectionHandled, undefined, this);
};

Promise.prototype._setReturnedNonUndefined = function() {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._returnedNonUndefined = function() {
    return (this._bitField & 268435456) !== 0;
};

Promise.prototype._notifyUnhandledRejection = function () {
    if (this._isRejectionUnhandled()) {
        var reason = this._settledValue();
        this._setUnhandledRejectionIsNotified();
        fireRejectionEvent("unhandledRejection",
                                      possiblyUnhandledRejection, reason, this);
    }
};

Promise.prototype._setUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField | 262144;
};

Promise.prototype._unsetUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField & (~262144);
};

Promise.prototype._isUnhandledRejectionNotified = function () {
    return (this._bitField & 262144) > 0;
};

Promise.prototype._setRejectionIsUnhandled = function () {
    this._bitField = this._bitField | 1048576;
};

Promise.prototype._unsetRejectionIsUnhandled = function () {
    this._bitField = this._bitField & (~1048576);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled = function () {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._warn = function(message, shouldUseOwnTrace, promise) {
    return warn(message, shouldUseOwnTrace, promise || this);
};

Promise.onPossiblyUnhandledRejection = function (fn) {
    var domain = getDomain();
    possiblyUnhandledRejection =
        typeof fn === "function" ? (domain === null ?
                                            fn : util.domainBind(domain, fn))
                                 : undefined;
};

Promise.onUnhandledRejectionHandled = function (fn) {
    var domain = getDomain();
    unhandledRejectionHandled =
        typeof fn === "function" ? (domain === null ?
                                            fn : util.domainBind(domain, fn))
                                 : undefined;
};

var disableLongStackTraces = function() {};
Promise.longStackTraces = function () {
    if (async.haveItemsQueued() && !config.longStackTraces) {
        throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    if (!config.longStackTraces && longStackTracesIsSupported()) {
        var Promise_captureStackTrace = Promise.prototype._captureStackTrace;
        var Promise_attachExtraTrace = Promise.prototype._attachExtraTrace;
        config.longStackTraces = true;
        disableLongStackTraces = function() {
            if (async.haveItemsQueued() && !config.longStackTraces) {
                throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
            }
            Promise.prototype._captureStackTrace = Promise_captureStackTrace;
            Promise.prototype._attachExtraTrace = Promise_attachExtraTrace;
            Context.deactivateLongStackTraces();
            async.enableTrampoline();
            config.longStackTraces = false;
        };
        Promise.prototype._captureStackTrace = longStackTracesCaptureStackTrace;
        Promise.prototype._attachExtraTrace = longStackTracesAttachExtraTrace;
        Context.activateLongStackTraces();
        async.disableTrampolineIfNecessary();
    }
};

Promise.hasLongStackTraces = function () {
    return config.longStackTraces && longStackTracesIsSupported();
};

var fireDomEvent = (function() {
    try {
        if (typeof CustomEvent === "function") {
            var event = new CustomEvent("CustomEvent");
            util.global.dispatchEvent(event);
            return function(name, event) {
                var domEvent = new CustomEvent(name.toLowerCase(), {
                    detail: event,
                    cancelable: true
                });
                return !util.global.dispatchEvent(domEvent);
            };
        } else if (typeof Event === "function") {
            var event = new Event("CustomEvent");
            util.global.dispatchEvent(event);
            return function(name, event) {
                var domEvent = new Event(name.toLowerCase(), {
                    cancelable: true
                });
                domEvent.detail = event;
                return !util.global.dispatchEvent(domEvent);
            };
        } else {
            var event = document.createEvent("CustomEvent");
            event.initCustomEvent("testingtheevent", false, true, {});
            util.global.dispatchEvent(event);
            return function(name, event) {
                var domEvent = document.createEvent("CustomEvent");
                domEvent.initCustomEvent(name.toLowerCase(), false, true,
                    event);
                return !util.global.dispatchEvent(domEvent);
            };
        }
    } catch (e) {}
    return function() {
        return false;
    };
})();

var fireGlobalEvent = (function() {
    if (util.isNode) {
        return function() {
            return process.emit.apply(process, arguments);
        };
    } else {
        if (!util.global) {
            return function() {
                return false;
            };
        }
        return function(name) {
            var methodName = "on" + name.toLowerCase();
            var method = util.global[methodName];
            if (!method) return false;
            method.apply(util.global, [].slice.call(arguments, 1));
            return true;
        };
    }
})();

function generatePromiseLifecycleEventObject(name, promise) {
    return {promise: promise};
}

var eventToObjectGenerator = {
    promiseCreated: generatePromiseLifecycleEventObject,
    promiseFulfilled: generatePromiseLifecycleEventObject,
    promiseRejected: generatePromiseLifecycleEventObject,
    promiseResolved: generatePromiseLifecycleEventObject,
    promiseCancelled: generatePromiseLifecycleEventObject,
    promiseChained: function(name, promise, child) {
        return {promise: promise, child: child};
    },
    warning: function(name, warning) {
        return {warning: warning};
    },
    unhandledRejection: function (name, reason, promise) {
        return {reason: reason, promise: promise};
    },
    rejectionHandled: generatePromiseLifecycleEventObject
};

var activeFireEvent = function (name) {
    var globalEventFired = false;
    try {
        globalEventFired = fireGlobalEvent.apply(null, arguments);
    } catch (e) {
        async.throwLater(e);
        globalEventFired = true;
    }

    var domEventFired = false;
    try {
        domEventFired = fireDomEvent(name,
                    eventToObjectGenerator[name].apply(null, arguments));
    } catch (e) {
        async.throwLater(e);
        domEventFired = true;
    }

    return domEventFired || globalEventFired;
};

Promise.config = function(opts) {
    opts = Object(opts);
    if ("longStackTraces" in opts) {
        if (opts.longStackTraces) {
            Promise.longStackTraces();
        } else if (!opts.longStackTraces && Promise.hasLongStackTraces()) {
            disableLongStackTraces();
        }
    }
    if ("warnings" in opts) {
        var warningsOption = opts.warnings;
        config.warnings = !!warningsOption;
        wForgottenReturn = config.warnings;

        if (util.isObject(warningsOption)) {
            if ("wForgottenReturn" in warningsOption) {
                wForgottenReturn = !!warningsOption.wForgottenReturn;
            }
        }
    }
    if ("cancellation" in opts && opts.cancellation && !config.cancellation) {
        if (async.haveItemsQueued()) {
            throw new Error(
                "cannot enable cancellation after promises are in use");
        }
        Promise.prototype._clearCancellationData =
            cancellationClearCancellationData;
        Promise.prototype._propagateFrom = cancellationPropagateFrom;
        Promise.prototype._onCancel = cancellationOnCancel;
        Promise.prototype._setOnCancel = cancellationSetOnCancel;
        Promise.prototype._attachCancellationCallback =
            cancellationAttachCancellationCallback;
        Promise.prototype._execute = cancellationExecute;
        propagateFromFunction = cancellationPropagateFrom;
        config.cancellation = true;
    }
    if ("monitoring" in opts) {
        if (opts.monitoring && !config.monitoring) {
            config.monitoring = true;
            Promise.prototype._fireEvent = activeFireEvent;
        } else if (!opts.monitoring && config.monitoring) {
            config.monitoring = false;
            Promise.prototype._fireEvent = defaultFireEvent;
        }
    }
};

function defaultFireEvent() { return false; }

Promise.prototype._fireEvent = defaultFireEvent;
Promise.prototype._execute = function(executor, resolve, reject) {
    try {
        executor(resolve, reject);
    } catch (e) {
        return e;
    }
};
Promise.prototype._onCancel = function () {};
Promise.prototype._setOnCancel = function (handler) { ; };
Promise.prototype._attachCancellationCallback = function(onCancel) {
    ;
};
Promise.prototype._captureStackTrace = function () {};
Promise.prototype._attachExtraTrace = function () {};
Promise.prototype._clearCancellationData = function() {};
Promise.prototype._propagateFrom = function (parent, flags) {
    ;
    ;
};

function cancellationExecute(executor, resolve, reject) {
    var promise = this;
    try {
        executor(resolve, reject, function(onCancel) {
            if (typeof onCancel !== "function") {
                throw new TypeError("onCancel must be a function, got: " +
                                    util.toString(onCancel));
            }
            promise._attachCancellationCallback(onCancel);
        });
    } catch (e) {
        return e;
    }
}

function cancellationAttachCancellationCallback(onCancel) {
    if (!this._isCancellable()) return this;

    var previousOnCancel = this._onCancel();
    if (previousOnCancel !== undefined) {
        if (util.isArray(previousOnCancel)) {
            previousOnCancel.push(onCancel);
        } else {
            this._setOnCancel([previousOnCancel, onCancel]);
        }
    } else {
        this._setOnCancel(onCancel);
    }
}

function cancellationOnCancel() {
    return this._onCancelField;
}

function cancellationSetOnCancel(onCancel) {
    this._onCancelField = onCancel;
}

function cancellationClearCancellationData() {
    this._cancellationParent = undefined;
    this._onCancelField = undefined;
}

function cancellationPropagateFrom(parent, flags) {
    if ((flags & 1) !== 0) {
        this._cancellationParent = parent;
        var branchesRemainingToCancel = parent._branchesRemainingToCancel;
        if (branchesRemainingToCancel === undefined) {
            branchesRemainingToCancel = 0;
        }
        parent._branchesRemainingToCancel = branchesRemainingToCancel + 1;
    }
    if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
}

function bindingPropagateFrom(parent, flags) {
    if ((flags & 2) !== 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
}
var propagateFromFunction = bindingPropagateFrom;

function boundValueFunction() {
    var ret = this._boundTo;
    if (ret !== undefined) {
        if (ret instanceof Promise) {
            if (ret.isFulfilled()) {
                return ret.value();
            } else {
                return undefined;
            }
        }
    }
    return ret;
}

function longStackTracesCaptureStackTrace() {
    this._trace = new CapturedTrace(this._peekContext());
}

function longStackTracesAttachExtraTrace(error, ignoreSelf) {
    if (canAttachTrace(error)) {
        var trace = this._trace;
        if (trace !== undefined) {
            if (ignoreSelf) trace = trace._parent;
        }
        if (trace !== undefined) {
            trace.attachExtraTrace(error);
        } else if (!error.__stackCleaned__) {
            var parsed = parseStackAndMessage(error);
            util.notEnumerableProp(error, "stack",
                parsed.message + "\n" + parsed.stack.join("\n"));
            util.notEnumerableProp(error, "__stackCleaned__", true);
        }
    }
}

function checkForgottenReturns(returnValue, promiseCreated, name, promise,
                               parent) {
    if (returnValue === undefined && promiseCreated !== null &&
        wForgottenReturn) {
        if (parent !== undefined && parent._returnedNonUndefined()) return;
        if ((promise._bitField & 65535) === 0) return;

        if (name) name = name + " ";
        var handlerLine = "";
        var creatorLine = "";
        if (promiseCreated._trace) {
            var traceLines = promiseCreated._trace.stack.split("\n");
            var stack = cleanStack(traceLines);
            for (var i = stack.length - 1; i >= 0; --i) {
                var line = stack[i];
                if (!nodeFramePattern.test(line)) {
                    var lineMatches = line.match(parseLinePattern);
                    if (lineMatches) {
                        handlerLine  = "at " + lineMatches[1] +
                            ":" + lineMatches[2] + ":" + lineMatches[3] + " ";
                    }
                    break;
                }
            }

            if (stack.length > 0) {
                var firstUserLine = stack[0];
                for (var i = 0; i < traceLines.length; ++i) {

                    if (traceLines[i] === firstUserLine) {
                        if (i > 0) {
                            creatorLine = "\n" + traceLines[i - 1];
                        }
                        break;
                    }
                }

            }
        }
        var msg = "a promise was created in a " + name +
            "handler " + handlerLine + "but was not returned from it, " +
            "see http://goo.gl/rRqMUw" +
            creatorLine;
        promise._warn(msg, true, promiseCreated);
    }
}

function deprecated(name, replacement) {
    var message = name +
        " is deprecated and will be removed in a future version.";
    if (replacement) message += " Use " + replacement + " instead.";
    return warn(message);
}

function warn(message, shouldUseOwnTrace, promise) {
    if (!config.warnings) return;
    var warning = new Warning(message);
    var ctx;
    if (shouldUseOwnTrace) {
        promise._attachExtraTrace(warning);
    } else if (config.longStackTraces && (ctx = Promise._peekContext())) {
        ctx.attachExtraTrace(warning);
    } else {
        var parsed = parseStackAndMessage(warning);
        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
    }

    if (!activeFireEvent("warning", warning)) {
        formatAndLogError(warning, "", true);
    }
}

function reconstructStack(message, stacks) {
    for (var i = 0; i < stacks.length - 1; ++i) {
        stacks[i].push("From previous event:");
        stacks[i] = stacks[i].join("\n");
    }
    if (i < stacks.length) {
        stacks[i] = stacks[i].join("\n");
    }
    return message + "\n" + stacks.join("\n");
}

function removeDuplicateOrEmptyJumps(stacks) {
    for (var i = 0; i < stacks.length; ++i) {
        if (stacks[i].length === 0 ||
            ((i + 1 < stacks.length) && stacks[i][0] === stacks[i+1][0])) {
            stacks.splice(i, 1);
            i--;
        }
    }
}

function removeCommonRoots(stacks) {
    var current = stacks[0];
    for (var i = 1; i < stacks.length; ++i) {
        var prev = stacks[i];
        var currentLastIndex = current.length - 1;
        var currentLastLine = current[currentLastIndex];
        var commonRootMeetPoint = -1;

        for (var j = prev.length - 1; j >= 0; --j) {
            if (prev[j] === currentLastLine) {
                commonRootMeetPoint = j;
                break;
            }
        }

        for (var j = commonRootMeetPoint; j >= 0; --j) {
            var line = prev[j];
            if (current[currentLastIndex] === line) {
                current.pop();
                currentLastIndex--;
            } else {
                break;
            }
        }
        current = prev;
    }
}

function cleanStack(stack) {
    var ret = [];
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        var isTraceLine = "    (No stack trace)" === line ||
            stackFramePattern.test(line);
        var isInternalFrame = isTraceLine && shouldIgnore(line);
        if (isTraceLine && !isInternalFrame) {
            if (indentStackFrames && line.charAt(0) !== " ") {
                line = "    " + line;
            }
            ret.push(line);
        }
    }
    return ret;
}

function stackFramesAsArray(error) {
    var stack = error.stack.replace(/\s+$/g, "").split("\n");
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        if ("    (No stack trace)" === line || stackFramePattern.test(line)) {
            break;
        }
    }
    if (i > 0) {
        stack = stack.slice(i);
    }
    return stack;
}

function parseStackAndMessage(error) {
    var stack = error.stack;
    var message = error.toString();
    stack = typeof stack === "string" && stack.length > 0
                ? stackFramesAsArray(error) : ["    (No stack trace)"];
    return {
        message: message,
        stack: cleanStack(stack)
    };
}

function formatAndLogError(error, title, isSoft) {
    if (typeof console !== "undefined") {
        var message;
        if (util.isObject(error)) {
            var stack = error.stack;
            message = title + formatStack(stack, error);
        } else {
            message = title + String(error);
        }
        if (typeof printWarning === "function") {
            printWarning(message, isSoft);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
}

function fireRejectionEvent(name, localHandler, reason, promise) {
    var localEventFired = false;
    try {
        if (typeof localHandler === "function") {
            localEventFired = true;
            if (name === "rejectionHandled") {
                localHandler(promise);
            } else {
                localHandler(reason, promise);
            }
        }
    } catch (e) {
        async.throwLater(e);
    }

    if (name === "unhandledRejection") {
        if (!activeFireEvent(name, reason, promise) && !localEventFired) {
            formatAndLogError(reason, "Unhandled rejection ");
        }
    } else {
        activeFireEvent(name, promise);
    }
}

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj && typeof obj.toString === "function"
            ? obj.toString() : util.toString(obj);
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

function longStackTracesIsSupported() {
    return typeof captureStackTrace === "function";
}

var shouldIgnore = function() { return false; };
var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
function parseLineInfo(line) {
    var matches = line.match(parseLineInfoRegex);
    if (matches) {
        return {
            fileName: matches[1],
            line: parseInt(matches[2], 10)
        };
    }
}

function setBounds(firstLineError, lastLineError) {
    if (!longStackTracesIsSupported()) return;
    var firstStackLines = firstLineError.stack.split("\n");
    var lastStackLines = lastLineError.stack.split("\n");
    var firstIndex = -1;
    var lastIndex = -1;
    var firstFileName;
    var lastFileName;
    for (var i = 0; i < firstStackLines.length; ++i) {
        var result = parseLineInfo(firstStackLines[i]);
        if (result) {
            firstFileName = result.fileName;
            firstIndex = result.line;
            break;
        }
    }
    for (var i = 0; i < lastStackLines.length; ++i) {
        var result = parseLineInfo(lastStackLines[i]);
        if (result) {
            lastFileName = result.fileName;
            lastIndex = result.line;
            break;
        }
    }
    if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName ||
        firstFileName !== lastFileName || firstIndex >= lastIndex) {
        return;
    }

    shouldIgnore = function(line) {
        if (bluebirdFramePattern.test(line)) return true;
        var info = parseLineInfo(line);
        if (info) {
            if (info.fileName === firstFileName &&
                (firstIndex <= info.line && info.line <= lastIndex)) {
                return true;
            }
        }
        return false;
    };
}

function CapturedTrace(parent) {
    this._parent = parent;
    this._promisesCreated = 0;
    var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
    captureStackTrace(this, CapturedTrace);
    if (length > 32) this.uncycle();
}
util.inherits(CapturedTrace, Error);
Context.CapturedTrace = CapturedTrace;

CapturedTrace.prototype.uncycle = function() {
    var length = this._length;
    if (length < 2) return;
    var nodes = [];
    var stackToIndex = {};

    for (var i = 0, node = this; node !== undefined; ++i) {
        nodes.push(node);
        node = node._parent;
    }
    length = this._length = i;
    for (var i = length - 1; i >= 0; --i) {
        var stack = nodes[i].stack;
        if (stackToIndex[stack] === undefined) {
            stackToIndex[stack] = i;
        }
    }
    for (var i = 0; i < length; ++i) {
        var currentStack = nodes[i].stack;
        var index = stackToIndex[currentStack];
        if (index !== undefined && index !== i) {
            if (index > 0) {
                nodes[index - 1]._parent = undefined;
                nodes[index - 1]._length = 1;
            }
            nodes[i]._parent = undefined;
            nodes[i]._length = 1;
            var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;

            if (index < length - 1) {
                cycleEdgeNode._parent = nodes[index + 1];
                cycleEdgeNode._parent.uncycle();
                cycleEdgeNode._length =
                    cycleEdgeNode._parent._length + 1;
            } else {
                cycleEdgeNode._parent = undefined;
                cycleEdgeNode._length = 1;
            }
            var currentChildLength = cycleEdgeNode._length + 1;
            for (var j = i - 2; j >= 0; --j) {
                nodes[j]._length = currentChildLength;
                currentChildLength++;
            }
            return;
        }
    }
};

CapturedTrace.prototype.attachExtraTrace = function(error) {
    if (error.__stackCleaned__) return;
    this.uncycle();
    var parsed = parseStackAndMessage(error);
    var message = parsed.message;
    var stacks = [parsed.stack];

    var trace = this;
    while (trace !== undefined) {
        stacks.push(cleanStack(trace.stack.split("\n")));
        trace = trace._parent;
    }
    removeCommonRoots(stacks);
    removeDuplicateOrEmptyJumps(stacks);
    util.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
    util.notEnumerableProp(error, "__stackCleaned__", true);
};

var captureStackTrace = (function stackDetection() {
    var v8stackFramePattern = /^\s*at\s*/;
    var v8stackFormatter = function(stack, error) {
        if (typeof stack === "string") return stack;

        if (error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        Error.stackTraceLimit += 6;
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        var captureStackTrace = Error.captureStackTrace;

        shouldIgnore = function(line) {
            return bluebirdFramePattern.test(line);
        };
        return function(receiver, ignoreUntil) {
            Error.stackTraceLimit += 6;
            captureStackTrace(receiver, ignoreUntil);
            Error.stackTraceLimit -= 6;
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
        stackFramePattern = /@/;
        formatStack = v8stackFormatter;
        indentStackFrames = true;
        return function captureStackTrace(o) {
            o.stack = new Error().stack;
        };
    }

    var hasStackAfterThrow;
    try { throw new Error(); }
    catch(e) {
        hasStackAfterThrow = ("stack" in e);
    }
    if (!("stack" in err) && hasStackAfterThrow &&
        typeof Error.stackTraceLimit === "number") {
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        return function captureStackTrace(o) {
            Error.stackTraceLimit += 6;
            try { throw new Error(); }
            catch(e) { o.stack = e.stack; }
            Error.stackTraceLimit -= 6;
        };
    }

    formatStack = function(stack, error) {
        if (typeof stack === "string") return stack;

        if ((typeof error === "object" ||
            typeof error === "function") &&
            error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    return null;

})([]);

if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
    printWarning = function (message) {
        console.warn(message);
    };
    if (util.isNode && process.stderr.isTTY) {
        printWarning = function(message, isSoft) {
            var color = isSoft ? "\u001b[33m" : "\u001b[31m";
            console.warn(color + message + "\u001b[0m\n");
        };
    } else if (!util.isNode && typeof (new Error().stack) === "string") {
        printWarning = function(message, isSoft) {
            console.warn("%c" + message,
                        isSoft ? "color: darkorange" : "color: red");
        };
    }
}

var config = {
    warnings: warnings,
    longStackTraces: false,
    cancellation: false,
    monitoring: false
};

if (longStackTraces) Promise.longStackTraces();

return {
    longStackTraces: function() {
        return config.longStackTraces;
    },
    warnings: function() {
        return config.warnings;
    },
    cancellation: function() {
        return config.cancellation;
    },
    monitoring: function() {
        return config.monitoring;
    },
    propagateFromFunction: function() {
        return propagateFromFunction;
    },
    boundValueFunction: function() {
        return boundValueFunction;
    },
    checkForgottenReturns: checkForgottenReturns,
    setBounds: setBounds,
    warn: warn,
    deprecated: deprecated,
    CapturedTrace: CapturedTrace,
    fireDomEvent: fireDomEvent,
    fireGlobalEvent: fireGlobalEvent
};
};

},{"./errors":12,"./util":36}],10:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function returner() {
    return this.value;
}
function thrower() {
    throw this.reason;
}

Promise.prototype["return"] =
Promise.prototype.thenReturn = function (value) {
    if (value instanceof Promise) value.suppressUnhandledRejections();
    return this._then(
        returner, undefined, undefined, {value: value}, undefined);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow = function (reason) {
    return this._then(
        thrower, undefined, undefined, {reason: reason}, undefined);
};

Promise.prototype.catchThrow = function (reason) {
    if (arguments.length <= 1) {
        return this._then(
            undefined, thrower, undefined, {reason: reason}, undefined);
    } else {
        var _reason = arguments[1];
        var handler = function() {throw _reason;};
        return this.caught(reason, handler);
    }
};

Promise.prototype.catchReturn = function (value) {
    if (arguments.length <= 1) {
        if (value instanceof Promise) value.suppressUnhandledRejections();
        return this._then(
            undefined, returner, undefined, {value: value}, undefined);
    } else {
        var _value = arguments[1];
        if (_value instanceof Promise) _value.suppressUnhandledRejections();
        var handler = function() {return _value;};
        return this.caught(value, handler);
    }
};
};

},{}],11:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseReduce = Promise.reduce;
var PromiseAll = Promise.all;

function promiseAllThis() {
    return PromiseAll(this);
}

function PromiseMapSeries(promises, fn) {
    return PromiseReduce(promises, fn, INTERNAL, INTERNAL);
}

Promise.prototype.each = function (fn) {
    return PromiseReduce(this, fn, INTERNAL, 0)
              ._then(promiseAllThis, undefined, undefined, this, undefined);
};

Promise.prototype.mapSeries = function (fn) {
    return PromiseReduce(this, fn, INTERNAL, INTERNAL);
};

Promise.each = function (promises, fn) {
    return PromiseReduce(promises, fn, INTERNAL, 0)
              ._then(promiseAllThis, undefined, undefined, promises, undefined);
};

Promise.mapSeries = PromiseMapSeries;
};


},{}],12:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5");
var Objectfreeze = es5.freeze;
var util = _dereq_("./util");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        notEnumerableProp(this, "message",
            typeof message === "string" ? message : defaultMessage);
        notEnumerableProp(this, "name", nameProperty);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            Error.call(this);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var Warning = subError("Warning", "warning");
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

es5.defineProperty(AggregateError.prototype, "length", {
    value: 0,
    configurable: false,
    writable: true,
    enumerable: true
});
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    if (!(this instanceof OperationalError))
        return new OperationalError(message);
    notEnumerableProp(this, "name", "OperationalError");
    notEnumerableProp(this, "message", message);
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        notEnumerableProp(this, "message", message.message);
        notEnumerableProp(this, "stack", message.stack);
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var errorTypes = Error["__BluebirdErrorTypes__"];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    es5.defineProperty(Error, "__BluebirdErrorTypes__", {
        value: errorTypes,
        writable: false,
        enumerable: false,
        configurable: false
    });
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    Warning: Warning
};

},{"./es5":13,"./util":36}],13:[function(_dereq_,module,exports){
var isES5 = (function(){
    "use strict";
    return this === undefined;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        getDescriptor: Object.getOwnPropertyDescriptor,
        keys: Object.keys,
        names: Object.getOwnPropertyNames,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5,
        propertyIsWritable: function(obj, prop) {
            var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            return !!(!descriptor || descriptor.writable || descriptor.set);
        }
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function (o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    };

    var ObjectGetDescriptor = function(o, key) {
        return {value: o[key]};
    };

    var ObjectDefineProperty = function (o, key, desc) {
        o[key] = desc.value;
        return o;
    };

    var ObjectFreeze = function (obj) {
        return obj;
    };

    var ObjectGetPrototypeOf = function (obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    };

    var ArrayIsArray = function (obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    };

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        names: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        getDescriptor: ObjectGetDescriptor,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5,
        propertyIsWritable: function() {
            return true;
        }
    };
}

},{}],14:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseMap = Promise.map;

Promise.prototype.filter = function (fn, options) {
    return PromiseMap(this, fn, options, INTERNAL);
};

Promise.filter = function (promises, fn, options) {
    return PromiseMap(promises, fn, options, INTERNAL);
};
};

},{}],15:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, tryConvertToPromise) {
var util = _dereq_("./util");
var CancellationError = Promise.CancellationError;
var errorObj = util.errorObj;

function PassThroughHandlerContext(promise, type, handler) {
    this.promise = promise;
    this.type = type;
    this.handler = handler;
    this.called = false;
    this.cancelPromise = null;
}

PassThroughHandlerContext.prototype.isFinallyHandler = function() {
    return this.type === 0;
};

function FinallyHandlerCancelReaction(finallyHandler) {
    this.finallyHandler = finallyHandler;
}

FinallyHandlerCancelReaction.prototype._resultCancelled = function() {
    checkCancel(this.finallyHandler);
};

function checkCancel(ctx, reason) {
    if (ctx.cancelPromise != null) {
        if (arguments.length > 1) {
            ctx.cancelPromise._reject(reason);
        } else {
            ctx.cancelPromise._cancel();
        }
        ctx.cancelPromise = null;
        return true;
    }
    return false;
}

function succeed() {
    return finallyHandler.call(this, this.promise._target()._settledValue());
}
function fail(reason) {
    if (checkCancel(this, reason)) return;
    errorObj.e = reason;
    return errorObj;
}
function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    if (!this.called) {
        this.called = true;
        var ret = this.isFinallyHandler()
            ? handler.call(promise._boundValue())
            : handler.call(promise._boundValue(), reasonOrValue);
        if (ret !== undefined) {
            promise._setReturnedNonUndefined();
            var maybePromise = tryConvertToPromise(ret, promise);
            if (maybePromise instanceof Promise) {
                if (this.cancelPromise != null) {
                    if (maybePromise._isCancelled()) {
                        var reason =
                            new CancellationError("late cancellation observer");
                        promise._attachExtraTrace(reason);
                        errorObj.e = reason;
                        return errorObj;
                    } else if (maybePromise.isPending()) {
                        maybePromise._attachCancellationCallback(
                            new FinallyHandlerCancelReaction(this));
                    }
                }
                return maybePromise._then(
                    succeed, fail, undefined, this, undefined);
            }
        }
    }

    if (promise.isRejected()) {
        checkCancel(this);
        errorObj.e = reasonOrValue;
        return errorObj;
    } else {
        checkCancel(this);
        return reasonOrValue;
    }
}

Promise.prototype._passThrough = function(handler, type, success, fail) {
    if (typeof handler !== "function") return this.then();
    return this._then(success,
                      fail,
                      undefined,
                      new PassThroughHandlerContext(this, type, handler),
                      undefined);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function (handler) {
    return this._passThrough(handler,
                             0,
                             finallyHandler,
                             finallyHandler);
};

Promise.prototype.tap = function (handler) {
    return this._passThrough(handler, 1, finallyHandler);
};

return PassThroughHandlerContext;
};

},{"./util":36}],16:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          apiRejection,
                          INTERNAL,
                          tryConvertToPromise,
                          Proxyable,
                          debug) {
var errors = _dereq_("./errors");
var TypeError = errors.TypeError;
var util = _dereq_("./util");
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
var yieldHandlers = [];

function promiseFromYieldHandler(value, yieldHandlers, traceParent) {
    for (var i = 0; i < yieldHandlers.length; ++i) {
        traceParent._pushContext();
        var result = tryCatch(yieldHandlers[i])(value);
        traceParent._popContext();
        if (result === errorObj) {
            traceParent._pushContext();
            var ret = Promise.reject(errorObj.e);
            traceParent._popContext();
            return ret;
        }
        var maybePromise = tryConvertToPromise(result, traceParent);
        if (maybePromise instanceof Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver, yieldHandler, stack) {
    if (debug.cancellation()) {
        var internal = new Promise(INTERNAL);
        var _finallyPromise = this._finallyPromise = new Promise(INTERNAL);
        this._promise = internal.lastly(function() {
            return _finallyPromise;
        });
        internal._captureStackTrace();
        internal._setOnCancel(this);
    } else {
        var promise = this._promise = new Promise(INTERNAL);
        promise._captureStackTrace();
    }
    this._stack = stack;
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = undefined;
    this._yieldHandlers = typeof yieldHandler === "function"
        ? [yieldHandler].concat(yieldHandlers)
        : yieldHandlers;
    this._yieldedPromise = null;
    this._cancellationPhase = false;
}
util.inherits(PromiseSpawn, Proxyable);

PromiseSpawn.prototype._isResolved = function() {
    return this._promise === null;
};

PromiseSpawn.prototype._cleanup = function() {
    this._promise = this._generator = null;
    if (debug.cancellation() && this._finallyPromise !== null) {
        this._finallyPromise._fulfill();
        this._finallyPromise = null;
    }
};

PromiseSpawn.prototype._promiseCancelled = function() {
    if (this._isResolved()) return;
    var implementsReturn = typeof this._generator["return"] !== "undefined";

    var result;
    if (!implementsReturn) {
        var reason = new Promise.CancellationError(
            "generator .return() sentinel");
        Promise.coroutine.returnSentinel = reason;
        this._promise._attachExtraTrace(reason);
        this._promise._pushContext();
        result = tryCatch(this._generator["throw"]).call(this._generator,
                                                         reason);
        this._promise._popContext();
    } else {
        this._promise._pushContext();
        result = tryCatch(this._generator["return"]).call(this._generator,
                                                          undefined);
        this._promise._popContext();
    }
    this._cancellationPhase = true;
    this._yieldedPromise = null;
    this._continue(result);
};

PromiseSpawn.prototype._promiseFulfilled = function(value) {
    this._yieldedPromise = null;
    this._promise._pushContext();
    var result = tryCatch(this._generator.next).call(this._generator, value);
    this._promise._popContext();
    this._continue(result);
};

PromiseSpawn.prototype._promiseRejected = function(reason) {
    this._yieldedPromise = null;
    this._promise._attachExtraTrace(reason);
    this._promise._pushContext();
    var result = tryCatch(this._generator["throw"])
        .call(this._generator, reason);
    this._promise._popContext();
    this._continue(result);
};

PromiseSpawn.prototype._resultCancelled = function() {
    if (this._yieldedPromise instanceof Promise) {
        var promise = this._yieldedPromise;
        this._yieldedPromise = null;
        promise.cancel();
    }
};

PromiseSpawn.prototype.promise = function () {
    return this._promise;
};

PromiseSpawn.prototype._run = function () {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = undefined;
    this._promiseFulfilled(undefined);
};

PromiseSpawn.prototype._continue = function (result) {
    var promise = this._promise;
    if (result === errorObj) {
        this._cleanup();
        if (this._cancellationPhase) {
            return promise.cancel();
        } else {
            return promise._rejectCallback(result.e, false);
        }
    }

    var value = result.value;
    if (result.done === true) {
        this._cleanup();
        if (this._cancellationPhase) {
            return promise.cancel();
        } else {
            return promise._resolveCallback(value);
        }
    } else {
        var maybePromise = tryConvertToPromise(value, this._promise);
        if (!(maybePromise instanceof Promise)) {
            maybePromise =
                promiseFromYieldHandler(maybePromise,
                                        this._yieldHandlers,
                                        this._promise);
            if (maybePromise === null) {
                this._promiseRejected(
                    new TypeError(
                        "A value %s was yielded that could not be treated as a promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a\u000a".replace("%s", value) +
                        "From coroutine:\u000a" +
                        this._stack.split("\n").slice(1, -7).join("\n")
                    )
                );
                return;
            }
        }
        maybePromise = maybePromise._target();
        var bitField = maybePromise._bitField;
        ;
        if (((bitField & 50397184) === 0)) {
            this._yieldedPromise = maybePromise;
            maybePromise._proxy(this, null);
        } else if (((bitField & 33554432) !== 0)) {
            Promise._async.invoke(
                this._promiseFulfilled, this, maybePromise._value()
            );
        } else if (((bitField & 16777216) !== 0)) {
            Promise._async.invoke(
                this._promiseRejected, this, maybePromise._reason()
            );
        } else {
            this._promiseCancelled();
        }
    }
};

Promise.coroutine = function (generatorFunction, options) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    var yieldHandler = Object(options).yieldHandler;
    var PromiseSpawn$ = PromiseSpawn;
    var stack = new Error().stack;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(undefined, undefined, yieldHandler,
                                      stack);
        var ret = spawn.promise();
        spawn._generator = generator;
        spawn._promiseFulfilled(undefined);
        return ret;
    };
};

Promise.coroutine.addYieldHandler = function(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(fn));
    }
    yieldHandlers.push(fn);
};

Promise.spawn = function (generatorFunction) {
    debug.deprecated("Promise.spawn()", "Promise.coroutine()");
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors":12,"./util":36}],17:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, tryConvertToPromise, INTERNAL, async,
         getDomain) {
var util = _dereq_("./util");
var canEvaluate = util.canEvaluate;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var reject;

if (!true) {
if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var promiseSetter = function(i) {
        return new Function("promise", "holder", "                           \n\
            'use strict';                                                    \n\
            holder.pIndex = promise;                                         \n\
            ".replace(/Index/g, i));
    };

    var generateHolderClass = function(total) {
        var props = new Array(total);
        for (var i = 0; i < props.length; ++i) {
            props[i] = "this.p" + (i+1);
        }
        var assignment = props.join(" = ") + " = null;";
        var cancellationCode= "var promise;\n" + props.map(function(prop) {
            return "                                                         \n\
                promise = " + prop + ";                                      \n\
                if (promise instanceof Promise) {                            \n\
                    promise.cancel();                                        \n\
                }                                                            \n\
            ";
        }).join("\n");
        var passedArguments = props.join(", ");
        var name = "Holder$" + total;


        var code = "return function(tryCatch, errorObj, Promise, async) {    \n\
            'use strict';                                                    \n\
            function [TheName](fn) {                                         \n\
                [TheProperties]                                              \n\
                this.fn = fn;                                                \n\
                this.asyncNeeded = true;                                     \n\
                this.now = 0;                                                \n\
            }                                                                \n\
                                                                             \n\
            [TheName].prototype._callFunction = function(promise) {          \n\
                promise._pushContext();                                      \n\
                var ret = tryCatch(this.fn)([ThePassedArguments]);           \n\
                promise._popContext();                                       \n\
                if (ret === errorObj) {                                      \n\
                    promise._rejectCallback(ret.e, false);                   \n\
                } else {                                                     \n\
                    promise._resolveCallback(ret);                           \n\
                }                                                            \n\
            };                                                               \n\
                                                                             \n\
            [TheName].prototype.checkFulfillment = function(promise) {       \n\
                var now = ++this.now;                                        \n\
                if (now === [TheTotal]) {                                    \n\
                    if (this.asyncNeeded) {                                  \n\
                        async.invoke(this._callFunction, this, promise);     \n\
                    } else {                                                 \n\
                        this._callFunction(promise);                         \n\
                    }                                                        \n\
                                                                             \n\
                }                                                            \n\
            };                                                               \n\
                                                                             \n\
            [TheName].prototype._resultCancelled = function() {              \n\
                [CancellationCode]                                           \n\
            };                                                               \n\
                                                                             \n\
            return [TheName];                                                \n\
        }(tryCatch, errorObj, Promise, async);                               \n\
        ";

        code = code.replace(/\[TheName\]/g, name)
            .replace(/\[TheTotal\]/g, total)
            .replace(/\[ThePassedArguments\]/g, passedArguments)
            .replace(/\[TheProperties\]/g, assignment)
            .replace(/\[CancellationCode\]/g, cancellationCode);

        return new Function("tryCatch", "errorObj", "Promise", "async", code)
                           (tryCatch, errorObj, Promise, async);
    };

    var holderClasses = [];
    var thenCallbacks = [];
    var promiseSetters = [];

    for (var i = 0; i < 8; ++i) {
        holderClasses.push(generateHolderClass(i + 1));
        thenCallbacks.push(thenCallback(i + 1));
        promiseSetters.push(promiseSetter(i + 1));
    }

    reject = function (reason) {
        this._reject(reason);
    };
}}

Promise.join = function () {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (!true) {
            if (last <= 8 && canEvaluate) {
                var ret = new Promise(INTERNAL);
                ret._captureStackTrace();
                var HolderClass = holderClasses[last - 1];
                var holder = new HolderClass(fn);
                var callbacks = thenCallbacks;

                for (var i = 0; i < last; ++i) {
                    var maybePromise = tryConvertToPromise(arguments[i], ret);
                    if (maybePromise instanceof Promise) {
                        maybePromise = maybePromise._target();
                        var bitField = maybePromise._bitField;
                        ;
                        if (((bitField & 50397184) === 0)) {
                            maybePromise._then(callbacks[i], reject,
                                               undefined, ret, holder);
                            promiseSetters[i](maybePromise, holder);
                            holder.asyncNeeded = false;
                        } else if (((bitField & 33554432) !== 0)) {
                            callbacks[i].call(ret,
                                              maybePromise._value(), holder);
                        } else if (((bitField & 16777216) !== 0)) {
                            ret._reject(maybePromise._reason());
                        } else {
                            ret._cancel();
                        }
                    } else {
                        callbacks[i].call(ret, maybePromise, holder);
                    }
                }

                if (!ret._isFateSealed()) {
                    if (holder.asyncNeeded) {
                        var domain = getDomain();
                        if (domain !== null) {
                            holder.fn = util.domainBind(domain, holder.fn);
                        }
                    }
                    ret._setAsyncGuaranteed();
                    ret._setOnCancel(holder);
                }
                return ret;
            }
        }
    }
    var args = [].slice.call(arguments);;
    if (fn) args.pop();
    var ret = new PromiseArray(args).promise();
    return fn !== undefined ? ret.spread(fn) : ret;
};

};

},{"./util":36}],18:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL,
                          debug) {
var getDomain = Promise._getDomain;
var util = _dereq_("./util");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var async = Promise._async;

function MappingPromiseArray(promises, fn, limit, _filter) {
    this.constructor$(promises);
    this._promise._captureStackTrace();
    var domain = getDomain();
    this._callback = domain === null ? fn : util.domainBind(domain, fn);
    this._preservedValues = _filter === INTERNAL
        ? new Array(this.length())
        : null;
    this._limit = limit;
    this._inFlight = 0;
    this._queue = [];
    async.invoke(this._asyncInit, this, undefined);
}
util.inherits(MappingPromiseArray, PromiseArray);

MappingPromiseArray.prototype._asyncInit = function() {
    this._init$(undefined, -2);
};

MappingPromiseArray.prototype._init = function () {};

MappingPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var values = this._values;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var limit = this._limit;

    if (index < 0) {
        index = (index * -1) - 1;
        values[index] = value;
        if (limit >= 1) {
            this._inFlight--;
            this._drainQueue();
            if (this._isResolved()) return true;
        }
    } else {
        if (limit >= 1 && this._inFlight >= limit) {
            values[index] = value;
            this._queue.push(index);
            return false;
        }
        if (preservedValues !== null) preservedValues[index] = value;

        var promise = this._promise;
        var callback = this._callback;
        var receiver = promise._boundValue();
        promise._pushContext();
        var ret = tryCatch(callback).call(receiver, value, index, length);
        var promiseCreated = promise._popContext();
        debug.checkForgottenReturns(
            ret,
            promiseCreated,
            preservedValues !== null ? "Promise.filter" : "Promise.map",
            promise
        );
        if (ret === errorObj) {
            this._reject(ret.e);
            return true;
        }

        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            var bitField = maybePromise._bitField;
            ;
            if (((bitField & 50397184) === 0)) {
                if (limit >= 1) this._inFlight++;
                values[index] = maybePromise;
                maybePromise._proxy(this, (index + 1) * -1);
                return false;
            } else if (((bitField & 33554432) !== 0)) {
                ret = maybePromise._value();
            } else if (((bitField & 16777216) !== 0)) {
                this._reject(maybePromise._reason());
                return true;
            } else {
                this._cancel();
                return true;
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        if (preservedValues !== null) {
            this._filter(values, preservedValues);
        } else {
            this._resolve(values);
        }
        return true;
    }
    return false;
};

MappingPromiseArray.prototype._drainQueue = function () {
    var queue = this._queue;
    var limit = this._limit;
    var values = this._values;
    while (queue.length > 0 && this._inFlight < limit) {
        if (this._isResolved()) return;
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
    }
};

MappingPromiseArray.prototype._filter = function (booleans, values) {
    var len = values.length;
    var ret = new Array(len);
    var j = 0;
    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];
    }
    ret.length = j;
    this._resolve(ret);
};

MappingPromiseArray.prototype.preservedValues = function () {
    return this._preservedValues;
};

function map(promises, fn, options, _filter) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }

    var limit = 0;
    if (options !== undefined) {
        if (typeof options === "object" && options !== null) {
            if (typeof options.concurrency !== "number") {
                return Promise.reject(
                    new TypeError("'concurrency' must be a number but it is " +
                                    util.classString(options.concurrency)));
            }
            limit = options.concurrency;
        } else {
            return Promise.reject(new TypeError(
                            "options argument must be an object but it is " +
                             util.classString(options)));
        }
    }
    limit = typeof limit === "number" &&
        isFinite(limit) && limit >= 1 ? limit : 0;
    return new MappingPromiseArray(promises, fn, limit, _filter).promise();
}

Promise.prototype.map = function (fn, options) {
    return map(this, fn, options, null);
};

Promise.map = function (promises, fn, options, _filter) {
    return map(promises, fn, options, _filter);
};


};

},{"./util":36}],19:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, INTERNAL, tryConvertToPromise, apiRejection, debug) {
var util = _dereq_("./util");
var tryCatch = util.tryCatch;

Promise.method = function (fn) {
    if (typeof fn !== "function") {
        throw new Promise.TypeError("expecting a function but got " + util.classString(fn));
    }
    return function () {
        var ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        var promiseCreated = ret._popContext();
        debug.checkForgottenReturns(
            value, promiseCreated, "Promise.method", ret);
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function (fn) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._pushContext();
    var value;
    if (arguments.length > 1) {
        debug.deprecated("calling Promise.try with more than 1 argument");
        var arg = arguments[1];
        var ctx = arguments[2];
        value = util.isArray(arg) ? tryCatch(fn).apply(ctx, arg)
                                  : tryCatch(fn).call(ctx, arg);
    } else {
        value = tryCatch(fn)();
    }
    var promiseCreated = ret._popContext();
    debug.checkForgottenReturns(
        value, promiseCreated, "Promise.try", ret);
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.prototype._resolveFromSyncValue = function (value) {
    if (value === util.errorObj) {
        this._rejectCallback(value.e, false);
    } else {
        this._resolveCallback(value, true);
    }
};
};

},{"./util":36}],20:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors");
var OperationalError = errors.OperationalError;
var es5 = _dereq_("./es5");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

var rErrorKey = /^(?:name|message|stack|cause)$/;
function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
        ret.name = obj.name;
        ret.message = obj.message;
        ret.stack = obj.stack;
        var keys = es5.keys(obj);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (!rErrorKey.test(key)) {
                ret[key] = obj[key];
            }
        }
        return ret;
    }
    util.markAsOriginatingFromRejection(obj);
    return obj;
}

function nodebackForPromise(promise, multiArgs) {
    return function(err, value) {
        if (promise === null) return;
        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (!multiArgs) {
            promise._fulfill(value);
        } else {
            var args = [].slice.call(arguments, 1);;
            promise._fulfill(args);
        }
        promise = null;
    };
}

module.exports = nodebackForPromise;

},{"./errors":12,"./es5":13,"./util":36}],21:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var util = _dereq_("./util");
var async = Promise._async;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

function spreadAdapter(val, nodeback) {
    var promise = this;
    if (!util.isArray(val)) return successAdapter.call(promise, val, nodeback);
    var ret =
        tryCatch(nodeback).apply(promise._boundValue(), [null].concat(val));
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

function successAdapter(val, nodeback) {
    var promise = this;
    var receiver = promise._boundValue();
    var ret = val === undefined
        ? tryCatch(nodeback).call(receiver, null)
        : tryCatch(nodeback).call(receiver, null, val);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}
function errorAdapter(reason, nodeback) {
    var promise = this;
    if (!reason) {
        var newReason = new Error(reason + "");
        newReason.cause = reason;
        reason = newReason;
    }
    var ret = tryCatch(nodeback).call(promise._boundValue(), reason);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

Promise.prototype.asCallback = Promise.prototype.nodeify = function (nodeback,
                                                                     options) {
    if (typeof nodeback == "function") {
        var adapter = successAdapter;
        if (options !== undefined && Object(options).spread) {
            adapter = spreadAdapter;
        }
        this._then(
            adapter,
            errorAdapter,
            undefined,
            this,
            nodeback
        );
    }
    return this;
};
};

},{"./util":36}],22:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var makeSelfResolutionError = function () {
    return new TypeError("circular promise resolution chain\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
};
var reflectHandler = function() {
    return new Promise.PromiseInspection(this._target());
};
var apiRejection = function(msg) {
    return Promise.reject(new TypeError(msg));
};
function Proxyable() {}
var UNDEFINED_BINDING = {};
var util = _dereq_("./util");

var getDomain;
if (util.isNode) {
    getDomain = function() {
        var ret = process.domain;
        if (ret === undefined) ret = null;
        return ret;
    };
} else {
    getDomain = function() {
        return null;
    };
}
util.notEnumerableProp(Promise, "_getDomain", getDomain);

var es5 = _dereq_("./es5");
var Async = _dereq_("./async");
var async = new Async();
es5.defineProperty(Promise, "_async", {value: async});
var errors = _dereq_("./errors");
var TypeError = Promise.TypeError = errors.TypeError;
Promise.RangeError = errors.RangeError;
var CancellationError = Promise.CancellationError = errors.CancellationError;
Promise.TimeoutError = errors.TimeoutError;
Promise.OperationalError = errors.OperationalError;
Promise.RejectionError = errors.OperationalError;
Promise.AggregateError = errors.AggregateError;
var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {};
var tryConvertToPromise = _dereq_("./thenables")(Promise, INTERNAL);
var PromiseArray =
    _dereq_("./promise_array")(Promise, INTERNAL,
                               tryConvertToPromise, apiRejection, Proxyable);
var Context = _dereq_("./context")(Promise);
 /*jshint unused:false*/
var createContext = Context.create;
var debug = _dereq_("./debuggability")(Promise, Context);
var CapturedTrace = debug.CapturedTrace;
var PassThroughHandlerContext =
    _dereq_("./finally")(Promise, tryConvertToPromise);
var catchFilter = _dereq_("./catch_filter")(NEXT_FILTER);
var nodebackForPromise = _dereq_("./nodeback");
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
function check(self, executor) {
    if (typeof executor !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(executor));
    }
    if (self.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
}

function Promise(executor) {
    this._bitField = 0;
    this._fulfillmentHandler0 = undefined;
    this._rejectionHandler0 = undefined;
    this._promise0 = undefined;
    this._receiver0 = undefined;
    if (executor !== INTERNAL) {
        check(this, executor);
        this._resolveFromExecutor(executor);
    }
    this._promiseCreated();
    this._fireEvent("promiseCreated", this);
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] = function (fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (util.isObject(item)) {
                catchInstances[j++] = item;
            } else {
                return apiRejection("expecting an object but got " +
                    "A catch statement predicate " + util.classString(item));
            }
        }
        catchInstances.length = j;
        fn = arguments[i];
        return this.then(undefined, catchFilter(catchInstances, fn, this));
    }
    return this.then(undefined, fn);
};

Promise.prototype.reflect = function () {
    return this._then(reflectHandler,
        reflectHandler, undefined, this, undefined);
};

Promise.prototype.then = function (didFulfill, didReject) {
    if (debug.warnings() && arguments.length > 0 &&
        typeof didFulfill !== "function" &&
        typeof didReject !== "function") {
        var msg = ".then() only accepts functions but was passed: " +
                util.classString(didFulfill);
        if (arguments.length > 1) {
            msg += ", " + util.classString(didReject);
        }
        this._warn(msg);
    }
    return this._then(didFulfill, didReject, undefined, undefined, undefined);
};

Promise.prototype.done = function (didFulfill, didReject) {
    var promise =
        this._then(didFulfill, didReject, undefined, undefined, undefined);
    promise._setIsFinal();
};

Promise.prototype.spread = function (fn) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }
    return this.all()._then(fn, undefined, undefined, APPLY, undefined);
};

Promise.prototype.toJSON = function () {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: undefined,
        rejectionReason: undefined
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this.value();
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this.reason();
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function () {
    if (arguments.length > 0) {
        this._warn(".all() was passed arguments but it does not take any");
    }
    return new PromiseArray(this).promise();
};

Promise.prototype.error = function (fn) {
    return this.caught(util.originatesFromRejection, fn);
};

Promise.getNewLibraryCopy = module.exports;

Promise.is = function (val) {
    return val instanceof Promise;
};

Promise.fromNode = Promise.fromCallback = function(fn) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    var multiArgs = arguments.length > 1 ? !!Object(arguments[1]).multiArgs
                                         : false;
    var result = tryCatch(fn)(nodebackForPromise(ret, multiArgs));
    if (result === errorObj) {
        ret._rejectCallback(result.e, true);
    }
    if (!ret._isFateSealed()) ret._setAsyncGuaranteed();
    return ret;
};

Promise.all = function (promises) {
    return new PromiseArray(promises).promise();
};

Promise.cast = function (obj) {
    var ret = tryConvertToPromise(obj);
    if (!(ret instanceof Promise)) {
        ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._setFulfilled();
        ret._rejectionHandler0 = obj;
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function (reason) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._rejectCallback(reason, true);
    return ret;
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(fn));
    }
    return async.setScheduler(fn);
};

Promise.prototype._then = function (
    didFulfill,
    didReject,
    _,    receiver,
    internalData
) {
    var haveInternalData = internalData !== undefined;
    var promise = haveInternalData ? internalData : new Promise(INTERNAL);
    var target = this._target();
    var bitField = target._bitField;

    if (!haveInternalData) {
        promise._propagateFrom(this, 3);
        promise._captureStackTrace();
        if (receiver === undefined &&
            ((this._bitField & 2097152) !== 0)) {
            if (!((bitField & 50397184) === 0)) {
                receiver = this._boundValue();
            } else {
                receiver = target === this ? undefined : this._boundTo;
            }
        }
        this._fireEvent("promiseChained", this, promise);
    }

    var domain = getDomain();
    if (!((bitField & 50397184) === 0)) {
        var handler, value, settler = target._settlePromiseCtx;
        if (((bitField & 33554432) !== 0)) {
            value = target._rejectionHandler0;
            handler = didFulfill;
        } else if (((bitField & 16777216) !== 0)) {
            value = target._fulfillmentHandler0;
            handler = didReject;
            target._unsetRejectionIsUnhandled();
        } else {
            settler = target._settlePromiseLateCancellationObserver;
            value = new CancellationError("late cancellation observer");
            target._attachExtraTrace(value);
            handler = didReject;
        }

        async.invoke(settler, target, {
            handler: domain === null ? handler
                : (typeof handler === "function" &&
                    util.domainBind(domain, handler)),
            promise: promise,
            receiver: receiver,
            value: value
        });
    } else {
        target._addCallbacks(didFulfill, didReject, promise, receiver, domain);
    }

    return promise;
};

Promise.prototype._length = function () {
    return this._bitField & 65535;
};

Promise.prototype._isFateSealed = function () {
    return (this._bitField & 117506048) !== 0;
};

Promise.prototype._isFollowing = function () {
    return (this._bitField & 67108864) === 67108864;
};

Promise.prototype._setLength = function (len) {
    this._bitField = (this._bitField & -65536) |
        (len & 65535);
};

Promise.prototype._setFulfilled = function () {
    this._bitField = this._bitField | 33554432;
    this._fireEvent("promiseFulfilled", this);
};

Promise.prototype._setRejected = function () {
    this._bitField = this._bitField | 16777216;
    this._fireEvent("promiseRejected", this);
};

Promise.prototype._setFollowing = function () {
    this._bitField = this._bitField | 67108864;
    this._fireEvent("promiseResolved", this);
};

Promise.prototype._setIsFinal = function () {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._isFinal = function () {
    return (this._bitField & 4194304) > 0;
};

Promise.prototype._unsetCancelled = function() {
    this._bitField = this._bitField & (~65536);
};

Promise.prototype._setCancelled = function() {
    this._bitField = this._bitField | 65536;
    this._fireEvent("promiseCancelled", this);
};

Promise.prototype._setWillBeCancelled = function() {
    this._bitField = this._bitField | 8388608;
};

Promise.prototype._setAsyncGuaranteed = function() {
    if (async.hasCustomScheduler()) return;
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._receiverAt = function (index) {
    var ret = index === 0 ? this._receiver0 : this[
            index * 4 - 4 + 3];
    if (ret === UNDEFINED_BINDING) {
        return undefined;
    } else if (ret === undefined && this._isBound()) {
        return this._boundValue();
    }
    return ret;
};

Promise.prototype._promiseAt = function (index) {
    return this[
            index * 4 - 4 + 2];
};

Promise.prototype._fulfillmentHandlerAt = function (index) {
    return this[
            index * 4 - 4 + 0];
};

Promise.prototype._rejectionHandlerAt = function (index) {
    return this[
            index * 4 - 4 + 1];
};

Promise.prototype._boundValue = function() {};

Promise.prototype._migrateCallback0 = function (follower) {
    var bitField = follower._bitField;
    var fulfill = follower._fulfillmentHandler0;
    var reject = follower._rejectionHandler0;
    var promise = follower._promise0;
    var receiver = follower._receiverAt(0);
    if (receiver === undefined) receiver = UNDEFINED_BINDING;
    this._addCallbacks(fulfill, reject, promise, receiver, null);
};

Promise.prototype._migrateCallbackAt = function (follower, index) {
    var fulfill = follower._fulfillmentHandlerAt(index);
    var reject = follower._rejectionHandlerAt(index);
    var promise = follower._promiseAt(index);
    var receiver = follower._receiverAt(index);
    if (receiver === undefined) receiver = UNDEFINED_BINDING;
    this._addCallbacks(fulfill, reject, promise, receiver, null);
};

Promise.prototype._addCallbacks = function (
    fulfill,
    reject,
    promise,
    receiver,
    domain
) {
    var index = this._length();

    if (index >= 65535 - 4) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        this._receiver0 = receiver;
        if (typeof fulfill === "function") {
            this._fulfillmentHandler0 =
                domain === null ? fulfill : util.domainBind(domain, fulfill);
        }
        if (typeof reject === "function") {
            this._rejectionHandler0 =
                domain === null ? reject : util.domainBind(domain, reject);
        }
    } else {
        var base = index * 4 - 4;
        this[base + 2] = promise;
        this[base + 3] = receiver;
        if (typeof fulfill === "function") {
            this[base + 0] =
                domain === null ? fulfill : util.domainBind(domain, fulfill);
        }
        if (typeof reject === "function") {
            this[base + 1] =
                domain === null ? reject : util.domainBind(domain, reject);
        }
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._proxy = function (proxyable, arg) {
    this._addCallbacks(undefined, undefined, arg, proxyable, null);
};

Promise.prototype._resolveCallback = function(value, shouldBind) {
    if (((this._bitField & 117506048) !== 0)) return;
    if (value === this)
        return this._rejectCallback(makeSelfResolutionError(), false);
    var maybePromise = tryConvertToPromise(value, this);
    if (!(maybePromise instanceof Promise)) return this._fulfill(value);

    if (shouldBind) this._propagateFrom(maybePromise, 2);

    var promise = maybePromise._target();

    if (promise === this) {
        this._reject(makeSelfResolutionError());
        return;
    }

    var bitField = promise._bitField;
    if (((bitField & 50397184) === 0)) {
        var len = this._length();
        if (len > 0) promise._migrateCallback0(this);
        for (var i = 1; i < len; ++i) {
            promise._migrateCallbackAt(this, i);
        }
        this._setFollowing();
        this._setLength(0);
        this._setFollowee(promise);
    } else if (((bitField & 33554432) !== 0)) {
        this._fulfill(promise._value());
    } else if (((bitField & 16777216) !== 0)) {
        this._reject(promise._reason());
    } else {
        var reason = new CancellationError("late cancellation observer");
        promise._attachExtraTrace(reason);
        this._reject(reason);
    }
};

Promise.prototype._rejectCallback =
function(reason, synchronous, ignoreNonErrorWarnings) {
    var trace = util.ensureErrorObject(reason);
    var hasStack = trace === reason;
    if (!hasStack && !ignoreNonErrorWarnings && debug.warnings()) {
        var message = "a promise was rejected with a non-error: " +
            util.classString(reason);
        this._warn(message, true);
    }
    this._attachExtraTrace(trace, synchronous ? hasStack : false);
    this._reject(reason);
};

Promise.prototype._resolveFromExecutor = function (executor) {
    var promise = this;
    this._captureStackTrace();
    this._pushContext();
    var synchronous = true;
    var r = this._execute(executor, function(value) {
        promise._resolveCallback(value);
    }, function (reason) {
        promise._rejectCallback(reason, synchronous);
    });
    synchronous = false;
    this._popContext();

    if (r !== undefined) {
        promise._rejectCallback(r, true);
    }
};

Promise.prototype._settlePromiseFromHandler = function (
    handler, receiver, value, promise
) {
    var bitField = promise._bitField;
    if (((bitField & 65536) !== 0)) return;
    promise._pushContext();
    var x;
    if (receiver === APPLY) {
        if (!value || typeof value.length !== "number") {
            x = errorObj;
            x.e = new TypeError("cannot .spread() a non-array: " +
                                    util.classString(value));
        } else {
            x = tryCatch(handler).apply(this._boundValue(), value);
        }
    } else {
        x = tryCatch(handler).call(receiver, value);
    }
    var promiseCreated = promise._popContext();
    bitField = promise._bitField;
    if (((bitField & 65536) !== 0)) return;

    if (x === NEXT_FILTER) {
        promise._reject(value);
    } else if (x === errorObj) {
        promise._rejectCallback(x.e, false);
    } else {
        debug.checkForgottenReturns(x, promiseCreated, "",  promise, this);
        promise._resolveCallback(x);
    }
};

Promise.prototype._target = function() {
    var ret = this;
    while (ret._isFollowing()) ret = ret._followee();
    return ret;
};

Promise.prototype._followee = function() {
    return this._rejectionHandler0;
};

Promise.prototype._setFollowee = function(promise) {
    this._rejectionHandler0 = promise;
};

Promise.prototype._settlePromise = function(promise, handler, receiver, value) {
    var isPromise = promise instanceof Promise;
    var bitField = this._bitField;
    var asyncGuaranteed = ((bitField & 134217728) !== 0);
    if (((bitField & 65536) !== 0)) {
        if (isPromise) promise._invokeInternalOnCancel();

        if (receiver instanceof PassThroughHandlerContext &&
            receiver.isFinallyHandler()) {
            receiver.cancelPromise = promise;
            if (tryCatch(handler).call(receiver, value) === errorObj) {
                promise._reject(errorObj.e);
            }
        } else if (handler === reflectHandler) {
            promise._fulfill(reflectHandler.call(receiver));
        } else if (receiver instanceof Proxyable) {
            receiver._promiseCancelled(promise);
        } else if (isPromise || promise instanceof PromiseArray) {
            promise._cancel();
        } else {
            receiver.cancel();
        }
    } else if (typeof handler === "function") {
        if (!isPromise) {
            handler.call(receiver, value, promise);
        } else {
            if (asyncGuaranteed) promise._setAsyncGuaranteed();
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (receiver instanceof Proxyable) {
        if (!receiver._isResolved()) {
            if (((bitField & 33554432) !== 0)) {
                receiver._promiseFulfilled(value, promise);
            } else {
                receiver._promiseRejected(value, promise);
            }
        }
    } else if (isPromise) {
        if (asyncGuaranteed) promise._setAsyncGuaranteed();
        if (((bitField & 33554432) !== 0)) {
            promise._fulfill(value);
        } else {
            promise._reject(value);
        }
    }
};

Promise.prototype._settlePromiseLateCancellationObserver = function(ctx) {
    var handler = ctx.handler;
    var promise = ctx.promise;
    var receiver = ctx.receiver;
    var value = ctx.value;
    if (typeof handler === "function") {
        if (!(promise instanceof Promise)) {
            handler.call(receiver, value, promise);
        } else {
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (promise instanceof Promise) {
        promise._reject(value);
    }
};

Promise.prototype._settlePromiseCtx = function(ctx) {
    this._settlePromise(ctx.promise, ctx.handler, ctx.receiver, ctx.value);
};

Promise.prototype._settlePromise0 = function(handler, value, bitField) {
    var promise = this._promise0;
    var receiver = this._receiverAt(0);
    this._promise0 = undefined;
    this._receiver0 = undefined;
    this._settlePromise(promise, handler, receiver, value);
};

Promise.prototype._clearCallbackDataAtIndex = function(index) {
    var base = index * 4 - 4;
    this[base + 2] =
    this[base + 3] =
    this[base + 0] =
    this[base + 1] = undefined;
};

Promise.prototype._fulfill = function (value) {
    var bitField = this._bitField;
    if (((bitField & 117506048) >>> 16)) return;
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._reject(err);
    }
    this._setFulfilled();
    this._rejectionHandler0 = value;

    if ((bitField & 65535) > 0) {
        if (((bitField & 134217728) !== 0)) {
            this._settlePromises();
        } else {
            async.settlePromises(this);
        }
    }
};

Promise.prototype._reject = function (reason) {
    var bitField = this._bitField;
    if (((bitField & 117506048) >>> 16)) return;
    this._setRejected();
    this._fulfillmentHandler0 = reason;

    if (this._isFinal()) {
        return async.fatalError(reason, util.isNode);
    }

    if ((bitField & 65535) > 0) {
        async.settlePromises(this);
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._fulfillPromises = function (len, value) {
    for (var i = 1; i < len; i++) {
        var handler = this._fulfillmentHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, value);
    }
};

Promise.prototype._rejectPromises = function (len, reason) {
    for (var i = 1; i < len; i++) {
        var handler = this._rejectionHandlerAt(i);
        var promise = this._promiseAt(i);
        var receiver = this._receiverAt(i);
        this._clearCallbackDataAtIndex(i);
        this._settlePromise(promise, handler, receiver, reason);
    }
};

Promise.prototype._settlePromises = function () {
    var bitField = this._bitField;
    var len = (bitField & 65535);

    if (len > 0) {
        if (((bitField & 16842752) !== 0)) {
            var reason = this._fulfillmentHandler0;
            this._settlePromise0(this._rejectionHandler0, reason, bitField);
            this._rejectPromises(len, reason);
        } else {
            var value = this._rejectionHandler0;
            this._settlePromise0(this._fulfillmentHandler0, value, bitField);
            this._fulfillPromises(len, value);
        }
        this._setLength(0);
    }
    this._clearCancellationData();
};

Promise.prototype._settledValue = function() {
    var bitField = this._bitField;
    if (((bitField & 33554432) !== 0)) {
        return this._rejectionHandler0;
    } else if (((bitField & 16777216) !== 0)) {
        return this._fulfillmentHandler0;
    }
};

function deferResolve(v) {this.promise._resolveCallback(v);}
function deferReject(v) {this.promise._rejectCallback(v, false);}

Promise.defer = Promise.pending = function() {
    debug.deprecated("Promise.defer", "new Promise");
    var promise = new Promise(INTERNAL);
    return {
        promise: promise,
        resolve: deferResolve,
        reject: deferReject
    };
};

util.notEnumerableProp(Promise,
                       "_makeSelfResolutionError",
                       makeSelfResolutionError);

_dereq_("./method")(Promise, INTERNAL, tryConvertToPromise, apiRejection,
    debug);
_dereq_("./bind")(Promise, INTERNAL, tryConvertToPromise, debug);
_dereq_("./cancel")(Promise, PromiseArray, apiRejection, debug);
_dereq_("./direct_resolve")(Promise);
_dereq_("./synchronous_inspection")(Promise);
_dereq_("./join")(
    Promise, PromiseArray, tryConvertToPromise, INTERNAL, async, getDomain);
Promise.Promise = Promise;
Promise.version = "3.4.6";
_dereq_('./map.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
_dereq_('./call_get.js')(Promise);
_dereq_('./using.js')(Promise, apiRejection, tryConvertToPromise, createContext, INTERNAL, debug);
_dereq_('./timers.js')(Promise, INTERNAL, debug);
_dereq_('./generators.js')(Promise, apiRejection, INTERNAL, tryConvertToPromise, Proxyable, debug);
_dereq_('./nodeify.js')(Promise);
_dereq_('./promisify.js')(Promise, INTERNAL);
_dereq_('./props.js')(Promise, PromiseArray, tryConvertToPromise, apiRejection);
_dereq_('./race.js')(Promise, INTERNAL, tryConvertToPromise, apiRejection);
_dereq_('./reduce.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL, debug);
_dereq_('./settle.js')(Promise, PromiseArray, debug);
_dereq_('./some.js')(Promise, PromiseArray, apiRejection);
_dereq_('./filter.js')(Promise, INTERNAL);
_dereq_('./each.js')(Promise, INTERNAL);
_dereq_('./any.js')(Promise);
                                                         
    util.toFastProperties(Promise);                                          
    util.toFastProperties(Promise.prototype);                                
    function fillTypes(value) {                                              
        var p = new Promise(INTERNAL);                                       
        p._fulfillmentHandler0 = value;                                      
        p._rejectionHandler0 = value;                                        
        p._promise0 = value;                                                 
        p._receiver0 = value;                                                
    }                                                                        
    // Complete slack tracking, opt out of field-type tracking and           
    // stabilize map                                                         
    fillTypes({a: 1});                                                       
    fillTypes({b: 2});                                                       
    fillTypes({c: 3});                                                       
    fillTypes(1);                                                            
    fillTypes(function(){});                                                 
    fillTypes(undefined);                                                    
    fillTypes(false);                                                        
    fillTypes(new Promise(INTERNAL));                                        
    debug.setBounds(Async.firstLineError, util.lastLineError);               
    return Promise;                                                          

};

},{"./any.js":1,"./async":2,"./bind":3,"./call_get.js":5,"./cancel":6,"./catch_filter":7,"./context":8,"./debuggability":9,"./direct_resolve":10,"./each.js":11,"./errors":12,"./es5":13,"./filter.js":14,"./finally":15,"./generators.js":16,"./join":17,"./map.js":18,"./method":19,"./nodeback":20,"./nodeify.js":21,"./promise_array":23,"./promisify.js":24,"./props.js":25,"./race.js":27,"./reduce.js":28,"./settle.js":30,"./some.js":31,"./synchronous_inspection":32,"./thenables":33,"./timers.js":34,"./using.js":35,"./util":36}],23:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise,
    apiRejection, Proxyable) {
var util = _dereq_("./util");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    if (values instanceof Promise) {
        promise._propagateFrom(values, 3);
    }
    promise._setOnCancel(this);
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(undefined, -2);
}
util.inherits(PromiseArray, Proxyable);

PromiseArray.prototype.length = function () {
    return this._length;
};

PromiseArray.prototype.promise = function () {
    return this._promise;
};

PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
    var values = tryConvertToPromise(this._values, this._promise);
    if (values instanceof Promise) {
        values = values._target();
        var bitField = values._bitField;
        ;
        this._values = values;

        if (((bitField & 50397184) === 0)) {
            this._promise._setAsyncGuaranteed();
            return values._then(
                init,
                this._reject,
                undefined,
                this,
                resolveValueIfEmpty
           );
        } else if (((bitField & 33554432) !== 0)) {
            values = values._value();
        } else if (((bitField & 16777216) !== 0)) {
            return this._reject(values._reason());
        } else {
            return this._cancel();
        }
    }
    values = util.asArray(values);
    if (values === null) {
        var err = apiRejection(
            "expecting an array or an iterable object but got " + util.classString(values)).reason();
        this._promise._rejectCallback(err, false);
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    this._iterate(values);
};

PromiseArray.prototype._iterate = function(values) {
    var len = this.getActualLength(values.length);
    this._length = len;
    this._values = this.shouldCopyValues() ? new Array(len) : this._values;
    var result = this._promise;
    var isResolved = false;
    var bitField = null;
    for (var i = 0; i < len; ++i) {
        var maybePromise = tryConvertToPromise(values[i], result);

        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            bitField = maybePromise._bitField;
        } else {
            bitField = null;
        }

        if (isResolved) {
            if (bitField !== null) {
                maybePromise.suppressUnhandledRejections();
            }
        } else if (bitField !== null) {
            if (((bitField & 50397184) === 0)) {
                maybePromise._proxy(this, i);
                this._values[i] = maybePromise;
            } else if (((bitField & 33554432) !== 0)) {
                isResolved = this._promiseFulfilled(maybePromise._value(), i);
            } else if (((bitField & 16777216) !== 0)) {
                isResolved = this._promiseRejected(maybePromise._reason(), i);
            } else {
                isResolved = this._promiseCancelled(i);
            }
        } else {
            isResolved = this._promiseFulfilled(maybePromise, i);
        }
    }
    if (!isResolved) result._setAsyncGuaranteed();
};

PromiseArray.prototype._isResolved = function () {
    return this._values === null;
};

PromiseArray.prototype._resolve = function (value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype._cancel = function() {
    if (this._isResolved() || !this._promise._isCancellable()) return;
    this._values = null;
    this._promise._cancel();
};

PromiseArray.prototype._reject = function (reason) {
    this._values = null;
    this._promise._rejectCallback(reason, false);
};

PromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
        return true;
    }
    return false;
};

PromiseArray.prototype._promiseCancelled = function() {
    this._cancel();
    return true;
};

PromiseArray.prototype._promiseRejected = function (reason) {
    this._totalResolved++;
    this._reject(reason);
    return true;
};

PromiseArray.prototype._resultCancelled = function() {
    if (this._isResolved()) return;
    var values = this._values;
    this._cancel();
    if (values instanceof Promise) {
        values.cancel();
    } else {
        for (var i = 0; i < values.length; ++i) {
            if (values[i] instanceof Promise) {
                values[i].cancel();
            }
        }
    }
};

PromiseArray.prototype.shouldCopyValues = function () {
    return true;
};

PromiseArray.prototype.getActualLength = function (len) {
    return len;
};

return PromiseArray;
};

},{"./util":36}],24:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = _dereq_("./util");
var nodebackForPromise = _dereq_("./nodeback");
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var TypeError = _dereq_("./errors").TypeError;
var defaultSuffix = "Async";
var defaultPromisified = {__isPromisified__: true};
var noCopyProps = [
    "arity",    "length",
    "name",
    "arguments",
    "caller",
    "callee",
    "prototype",
    "__isPromisified__"
];
var noCopyPropsPattern = new RegExp("^(?:" + noCopyProps.join("|") + ")$");

var defaultFilter = function(name) {
    return util.isIdentifier(name) &&
        name.charAt(0) !== "_" &&
        name !== "constructor";
};

function propsFilter(key) {
    return !noCopyPropsPattern.test(key);
}

function isPromisified(fn) {
    try {
        return fn.__isPromisified__ === true;
    }
    catch (e) {
        return false;
    }
}

function hasPromisified(obj, key, suffix) {
    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                                            defaultPromisified);
    return val ? isPromisified(val) : false;
}
function checkValid(ret, suffix, suffixRegexp) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API that has normal methods with '%s'-suffix\u000a\u000a    See http://goo.gl/MqrFmX\u000a"
                        .replace("%s", suffix));
                }
            }
        }
    }
}

function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
    var keys = util.inheritedDataKeys(obj);
    var ret = [];
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        var passesDefaultFilter = filter === defaultFilter
            ? true : defaultFilter(key, value, obj);
        if (typeof value === "function" &&
            !isPromisified(value) &&
            !hasPromisified(obj, key, suffix) &&
            filter(key, value, obj, passesDefaultFilter)) {
            ret.push(key, value);
        }
    }
    checkValid(ret, suffix, suffixRegexp);
    return ret;
}

var escapeIdentRegex = function(str) {
    return str.replace(/([$])/, "\\$");
};

var makeNodePromisifiedEval;
if (!true) {
var switchCaseArgumentOrder = function(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 3);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 3; ++i) {
        ret.push(i);
    }
    return ret;
};

var argumentSequence = function(argumentCount) {
    return util.filledRange(argumentCount, "_arg", "");
};

var parameterDeclaration = function(parameterCount) {
    return util.filledRange(
        Math.max(parameterCount, 3), "_arg", "");
};

var parameterCount = function(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
};

makeNodePromisifiedEval =
function(callback, receiver, originalName, fn, _, multiArgs) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);
    var shouldProxyThis = typeof callback === "string" || receiver === THIS;

    function generateCallForArgumentCount(count) {
        var args = argumentSequence(count).join(", ");
        var comma = count > 0 ? ", " : "";
        var ret;
        if (shouldProxyThis) {
            ret = "ret = callback.call(this, {{args}}, nodeback); break;\n";
        } else {
            ret = receiver === undefined
                ? "ret = callback({{args}}, nodeback); break;\n"
                : "ret = callback.call(receiver, {{args}}, nodeback); break;\n";
        }
        return ret.replace("{{args}}", args).replace(", ", comma);
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for (var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }

        ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = nodeback;                                              \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", (shouldProxyThis
                                ? "ret = callback.apply(this, args);\n"
                                : "ret = callback.apply(receiver, args);\n"));
        return ret;
    }

    var getFunctionCode = typeof callback === "string"
                                ? ("this != null ? this['"+callback+"'] : fn")
                                : "fn";
    var body = "'use strict';                                                \n\
        var ret = function (Parameters) {                                    \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._captureStackTrace();                                    \n\
            var nodeback = nodebackForPromise(promise, " + multiArgs + ");   \n\
            var ret;                                                         \n\
            var callback = tryCatch([GetFunctionCode]);                      \n\
            switch(len) {                                                    \n\
                [CodeForSwitchCase]                                          \n\
            }                                                                \n\
            if (ret === errorObj) {                                          \n\
                promise._rejectCallback(maybeWrapAsError(ret.e), true, true);\n\
            }                                                                \n\
            if (!promise._isFateSealed()) promise._setAsyncGuaranteed();     \n\
            return promise;                                                  \n\
        };                                                                   \n\
        notEnumerableProp(ret, '__isPromisified__', true);                   \n\
        return ret;                                                          \n\
    ".replace("[CodeForSwitchCase]", generateArgumentSwitchCase())
        .replace("[GetFunctionCode]", getFunctionCode);
    body = body.replace("Parameters", parameterDeclaration(newParameterCount));
    return new Function("Promise",
                        "fn",
                        "receiver",
                        "withAppended",
                        "maybeWrapAsError",
                        "nodebackForPromise",
                        "tryCatch",
                        "errorObj",
                        "notEnumerableProp",
                        "INTERNAL",
                        body)(
                    Promise,
                    fn,
                    receiver,
                    withAppended,
                    maybeWrapAsError,
                    nodebackForPromise,
                    util.tryCatch,
                    util.errorObj,
                    util.notEnumerableProp,
                    INTERNAL);
};
}

function makeNodePromisifiedClosure(callback, receiver, _, fn, __, multiArgs) {
    var defaultThis = (function() {return this;})();
    var method = callback;
    if (typeof method === "string") {
        callback = fn;
    }
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        var promise = new Promise(INTERNAL);
        promise._captureStackTrace();
        var cb = typeof method === "string" && this !== defaultThis
            ? this[method] : callback;
        var fn = nodebackForPromise(promise, multiArgs);
        try {
            cb.apply(_receiver, withAppended(arguments, fn));
        } catch(e) {
            promise._rejectCallback(maybeWrapAsError(e), true, true);
        }
        if (!promise._isFateSealed()) promise._setAsyncGuaranteed();
        return promise;
    }
    util.notEnumerableProp(promisified, "__isPromisified__", true);
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function promisifyAll(obj, suffix, filter, promisifier, multiArgs) {
    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
    var methods =
        promisifiableMethods(obj, suffix, suffixRegexp, filter);

    for (var i = 0, len = methods.length; i < len; i+= 2) {
        var key = methods[i];
        var fn = methods[i+1];
        var promisifiedKey = key + suffix;
        if (promisifier === makeNodePromisified) {
            obj[promisifiedKey] =
                makeNodePromisified(key, THIS, key, fn, suffix, multiArgs);
        } else {
            var promisified = promisifier(fn, function() {
                return makeNodePromisified(key, THIS, key,
                                           fn, suffix, multiArgs);
            });
            util.notEnumerableProp(promisified, "__isPromisified__", true);
            obj[promisifiedKey] = promisified;
        }
    }
    util.toFastProperties(obj);
    return obj;
}

function promisify(callback, receiver, multiArgs) {
    return makeNodePromisified(callback, receiver, undefined,
                                callback, null, multiArgs);
}

Promise.promisify = function (fn, options) {
    if (typeof fn !== "function") {
        throw new TypeError("expecting a function but got " + util.classString(fn));
    }
    if (isPromisified(fn)) {
        return fn;
    }
    options = Object(options);
    var receiver = options.context === undefined ? THIS : options.context;
    var multiArgs = !!options.multiArgs;
    var ret = promisify(fn, receiver, multiArgs);
    util.copyDescriptors(fn, ret, propsFilter);
    return ret;
};

Promise.promisifyAll = function (target, options) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    options = Object(options);
    var multiArgs = !!options.multiArgs;
    var suffix = options.suffix;
    if (typeof suffix !== "string") suffix = defaultSuffix;
    var filter = options.filter;
    if (typeof filter !== "function") filter = defaultFilter;
    var promisifier = options.promisifier;
    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

    if (!util.isIdentifier(suffix)) {
        throw new RangeError("suffix must be a valid identifier\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }

    var keys = util.inheritedDataKeys(target);
    for (var i = 0; i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" &&
            util.isClass(value)) {
            promisifyAll(value.prototype, suffix, filter, promisifier,
                multiArgs);
            promisifyAll(value, suffix, filter, promisifier, multiArgs);
        }
    }

    return promisifyAll(target, suffix, filter, promisifier, multiArgs);
};
};


},{"./errors":12,"./nodeback":20,"./util":36}],25:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, PromiseArray, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util");
var isObject = util.isObject;
var es5 = _dereq_("./es5");
var Es6Map;
if (typeof Map === "function") Es6Map = Map;

var mapToEntries = (function() {
    var index = 0;
    var size = 0;

    function extractEntry(value, key) {
        this[index] = value;
        this[index + size] = key;
        index++;
    }

    return function mapToEntries(map) {
        size = map.size;
        index = 0;
        var ret = new Array(map.size * 2);
        map.forEach(extractEntry, ret);
        return ret;
    };
})();

var entriesToMap = function(entries) {
    var ret = new Es6Map();
    var length = entries.length / 2 | 0;
    for (var i = 0; i < length; ++i) {
        var key = entries[length + i];
        var value = entries[i];
        ret.set(key, value);
    }
    return ret;
};

function PropertiesPromiseArray(obj) {
    var isMap = false;
    var entries;
    if (Es6Map !== undefined && obj instanceof Es6Map) {
        entries = mapToEntries(obj);
        isMap = true;
    } else {
        var keys = es5.keys(obj);
        var len = keys.length;
        entries = new Array(len * 2);
        for (var i = 0; i < len; ++i) {
            var key = keys[i];
            entries[i] = obj[key];
            entries[i + len] = key;
        }
    }
    this.constructor$(entries);
    this._isMap = isMap;
    this._init$(undefined, -3);
}
util.inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init = function () {};

PropertiesPromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val;
        if (this._isMap) {
            val = entriesToMap(this._values);
        } else {
            val = {};
            var keyOffset = this.length();
            for (var i = 0, len = this.length(); i < len; ++i) {
                val[this._values[i + keyOffset]] = this._values[i];
            }
        }
        this._resolve(val);
        return true;
    }
    return false;
};

PropertiesPromiseArray.prototype.shouldCopyValues = function () {
    return false;
};

PropertiesPromiseArray.prototype.getActualLength = function (len) {
    return len >> 1;
};

function props(promises) {
    var ret;
    var castValue = tryConvertToPromise(promises);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    } else if (castValue instanceof Promise) {
        ret = castValue._then(
            Promise.props, undefined, undefined, undefined, undefined);
    } else {
        ret = new PropertiesPromiseArray(castValue).promise();
    }

    if (castValue instanceof Promise) {
        ret._propagateFrom(castValue, 2);
    }
    return ret;
}

Promise.prototype.props = function () {
    return props(this);
};

Promise.props = function (promises) {
    return props(promises);
};
};

},{"./es5":13,"./util":36}],26:[function(_dereq_,module,exports){
"use strict";
function arrayMove(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
        src[j + srcIndex] = void 0;
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
}

Queue.prototype._willBeOverCapacity = function (size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function (arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype._unshiftOne = function(value) {
    var capacity = this._capacity;
    this._checkCapacity(this.length() + 1);
    var front = this._front;
    var i = (((( front - 1 ) &
                    ( capacity - 1) ) ^ capacity ) - capacity );
    this[i] = value;
    this._front = i;
    this._length = this.length() + 1;
};

Queue.prototype.unshift = function(fn, receiver, arg) {
    this._unshiftOne(arg);
    this._unshiftOne(receiver);
    this._unshiftOne(fn);
};

Queue.prototype.push = function (fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function () {
    var front = this._front,
        ret = this[front];

    this[front] = undefined;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function () {
    return this._length;
};

Queue.prototype._checkCapacity = function (size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 1);
    }
};

Queue.prototype._resizeTo = function (capacity) {
    var oldCapacity = this._capacity;
    this._capacity = capacity;
    var front = this._front;
    var length = this._length;
    var moveItemsCount = (front + length) & (oldCapacity - 1);
    arrayMove(this, 0, this, oldCapacity, moveItemsCount);
};

module.exports = Queue;

},{}],27:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, INTERNAL, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util");

var raceLater = function (promise) {
    return promise.then(function(array) {
        return race(array, promise);
    });
};

function race(promises, parent) {
    var maybePromise = tryConvertToPromise(promises);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    } else {
        promises = util.asArray(promises);
        if (promises === null)
            return apiRejection("expecting an array or an iterable object but got " + util.classString(promises));
    }

    var ret = new Promise(INTERNAL);
    if (parent !== undefined) {
        ret._propagateFrom(parent, 3);
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === undefined && !(i in promises)) {
            continue;
        }

        Promise.cast(val)._then(fulfill, reject, undefined, ret, null);
    }
    return ret;
}

Promise.race = function (promises) {
    return race(promises, undefined);
};

Promise.prototype.race = function () {
    return race(this, undefined);
};

};

},{"./util":36}],28:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL,
                          debug) {
var getDomain = Promise._getDomain;
var util = _dereq_("./util");
var tryCatch = util.tryCatch;

function ReductionPromiseArray(promises, fn, initialValue, _each) {
    this.constructor$(promises);
    var domain = getDomain();
    this._fn = domain === null ? fn : util.domainBind(domain, fn);
    if (initialValue !== undefined) {
        initialValue = Promise.resolve(initialValue);
        initialValue._attachCancellationCallback(this);
    }
    this._initialValue = initialValue;
    this._currentCancellable = null;
    if(_each === INTERNAL) {
        this._eachValues = Array(this._length);
    } else if (_each === 0) {
        this._eachValues = null;
    } else {
        this._eachValues = undefined;
    }
    this._promise._captureStackTrace();
    this._init$(undefined, -5);
}
util.inherits(ReductionPromiseArray, PromiseArray);

ReductionPromiseArray.prototype._gotAccum = function(accum) {
    if (this._eachValues !== undefined && 
        this._eachValues !== null && 
        accum !== INTERNAL) {
        this._eachValues.push(accum);
    }
};

ReductionPromiseArray.prototype._eachComplete = function(value) {
    if (this._eachValues !== null) {
        this._eachValues.push(value);
    }
    return this._eachValues;
};

ReductionPromiseArray.prototype._init = function() {};

ReductionPromiseArray.prototype._resolveEmptyArray = function() {
    this._resolve(this._eachValues !== undefined ? this._eachValues
                                                 : this._initialValue);
};

ReductionPromiseArray.prototype.shouldCopyValues = function () {
    return false;
};

ReductionPromiseArray.prototype._resolve = function(value) {
    this._promise._resolveCallback(value);
    this._values = null;
};

ReductionPromiseArray.prototype._resultCancelled = function(sender) {
    if (sender === this._initialValue) return this._cancel();
    if (this._isResolved()) return;
    this._resultCancelled$();
    if (this._currentCancellable instanceof Promise) {
        this._currentCancellable.cancel();
    }
    if (this._initialValue instanceof Promise) {
        this._initialValue.cancel();
    }
};

ReductionPromiseArray.prototype._iterate = function (values) {
    this._values = values;
    var value;
    var i;
    var length = values.length;
    if (this._initialValue !== undefined) {
        value = this._initialValue;
        i = 0;
    } else {
        value = Promise.resolve(values[0]);
        i = 1;
    }

    this._currentCancellable = value;

    if (!value.isRejected()) {
        for (; i < length; ++i) {
            var ctx = {
                accum: null,
                value: values[i],
                index: i,
                length: length,
                array: this
            };
            value = value._then(gotAccum, undefined, undefined, ctx, undefined);
        }
    }

    if (this._eachValues !== undefined) {
        value = value
            ._then(this._eachComplete, undefined, undefined, this, undefined);
    }
    value._then(completed, completed, undefined, value, this);
};

Promise.prototype.reduce = function (fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function (promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};

function completed(valueOrReason, array) {
    if (this.isFulfilled()) {
        array._resolve(valueOrReason);
    } else {
        array._reject(valueOrReason);
    }
}

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") {
        return apiRejection("expecting a function but got " + util.classString(fn));
    }
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

function gotAccum(accum) {
    this.accum = accum;
    this.array._gotAccum(accum);
    var value = tryConvertToPromise(this.value, this.array._promise);
    if (value instanceof Promise) {
        this.array._currentCancellable = value;
        return value._then(gotValue, undefined, undefined, this, undefined);
    } else {
        return gotValue.call(this, value);
    }
}

function gotValue(value) {
    var array = this.array;
    var promise = array._promise;
    var fn = tryCatch(array._fn);
    promise._pushContext();
    var ret;
    if (array._eachValues !== undefined) {
        ret = fn.call(promise._boundValue(), value, this.index, this.length);
    } else {
        ret = fn.call(promise._boundValue(),
                              this.accum, value, this.index, this.length);
    }
    if (ret instanceof Promise) {
        array._currentCancellable = ret;
    }
    var promiseCreated = promise._popContext();
    debug.checkForgottenReturns(
        ret,
        promiseCreated,
        array._eachValues !== undefined ? "Promise.each" : "Promise.reduce",
        promise
    );
    return ret;
}
};

},{"./util":36}],29:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util");
var schedule;
var noAsyncScheduler = function() {
    throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
};
var NativePromise = util.getNativePromise();
if (util.isNode && typeof MutationObserver === "undefined") {
    var GlobalSetImmediate = global.setImmediate;
    var ProcessNextTick = process.nextTick;
    schedule = util.isRecentNode
                ? function(fn) { GlobalSetImmediate.call(global, fn); }
                : function(fn) { ProcessNextTick.call(process, fn); };
} else if (typeof NativePromise === "function" &&
           typeof NativePromise.resolve === "function") {
    var nativePromise = NativePromise.resolve();
    schedule = function(fn) {
        nativePromise.then(fn);
    };
} else if ((typeof MutationObserver !== "undefined") &&
          !(typeof window !== "undefined" &&
            window.navigator &&
            (window.navigator.standalone || window.cordova))) {
    schedule = (function() {
        var div = document.createElement("div");
        var opts = {attributes: true};
        var toggleScheduled = false;
        var div2 = document.createElement("div");
        var o2 = new MutationObserver(function() {
            div.classList.toggle("foo");
            toggleScheduled = false;
        });
        o2.observe(div2, opts);

        var scheduleToggle = function() {
            if (toggleScheduled) return;
                toggleScheduled = true;
                div2.classList.toggle("foo");
            };

            return function schedule(fn) {
            var o = new MutationObserver(function() {
                o.disconnect();
                fn();
            });
            o.observe(div, opts);
            scheduleToggle();
        };
    })();
} else if (typeof setImmediate !== "undefined") {
    schedule = function (fn) {
        setImmediate(fn);
    };
} else if (typeof setTimeout !== "undefined") {
    schedule = function (fn) {
        setTimeout(fn, 0);
    };
} else {
    schedule = noAsyncScheduler;
}
module.exports = schedule;

},{"./util":36}],30:[function(_dereq_,module,exports){
"use strict";
module.exports =
    function(Promise, PromiseArray, debug) {
var PromiseInspection = Promise.PromiseInspection;
var util = _dereq_("./util");

function SettledPromiseArray(values) {
    this.constructor$(values);
}
util.inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved = function (index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
        return true;
    }
    return false;
};

SettledPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var ret = new PromiseInspection();
    ret._bitField = 33554432;
    ret._settledValueField = value;
    return this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected = function (reason, index) {
    var ret = new PromiseInspection();
    ret._bitField = 16777216;
    ret._settledValueField = reason;
    return this._promiseResolved(index, ret);
};

Promise.settle = function (promises) {
    debug.deprecated(".settle()", ".reflect()");
    return new SettledPromiseArray(promises).promise();
};

Promise.prototype.settle = function () {
    return Promise.settle(this);
};
};

},{"./util":36}],31:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, apiRejection) {
var util = _dereq_("./util");
var RangeError = _dereq_("./errors").RangeError;
var AggregateError = _dereq_("./errors").AggregateError;
var isArray = util.isArray;
var CANCELLATION = {};


function SomePromiseArray(values) {
    this.constructor$(values);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
util.inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function () {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(undefined, -5);
    var isArrayResolved = isArray(this._values);
    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
    }
};

SomePromiseArray.prototype.init = function () {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function () {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function () {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany = function (count) {
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled = function (value) {
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        } else {
            this._resolve(this._values);
        }
        return true;
    }
    return false;

};
SomePromiseArray.prototype._promiseRejected = function (reason) {
    this._addRejected(reason);
    return this._checkOutcome();
};

SomePromiseArray.prototype._promiseCancelled = function () {
    if (this._values instanceof Promise || this._values == null) {
        return this._cancel();
    }
    this._addRejected(CANCELLATION);
    return this._checkOutcome();
};

SomePromiseArray.prototype._checkOutcome = function() {
    if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError();
        for (var i = this.length(); i < this._values.length; ++i) {
            if (this._values[i] !== CANCELLATION) {
                e.push(this._values[i]);
            }
        }
        if (e.length > 0) {
            this._reject(e);
        } else {
            this._cancel();
        }
        return true;
    }
    return false;
};

SomePromiseArray.prototype._fulfilled = function () {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function () {
    return this._values.length - this.length();
};

SomePromiseArray.prototype._addRejected = function (reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled = function (value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill = function () {
    return this.length() - this._rejected();
};

SomePromiseArray.prototype._getRangeError = function (count) {
    var message = "Input array must contain at least " +
            this._howMany + " items but contains only " + count + " items";
    return new RangeError(message);
};

SomePromiseArray.prototype._resolveEmptyArray = function () {
    this._reject(this._getRangeError(0));
};

function some(promises, howMany) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function (promises, howMany) {
    return some(promises, howMany);
};

Promise.prototype.some = function (howMany) {
    return some(this, howMany);
};

Promise._SomePromiseArray = SomePromiseArray;
};

},{"./errors":12,"./util":36}],32:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== undefined) {
        promise = promise._target();
        this._bitField = promise._bitField;
        this._settledValueField = promise._isFateSealed()
            ? promise._settledValue() : undefined;
    }
    else {
        this._bitField = 0;
        this._settledValueField = undefined;
    }
}

PromiseInspection.prototype._settledValue = function() {
    return this._settledValueField;
};

var value = PromiseInspection.prototype.value = function () {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    return this._settledValue();
};

var reason = PromiseInspection.prototype.error =
PromiseInspection.prototype.reason = function () {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/MqrFmX\u000a");
    }
    return this._settledValue();
};

var isFulfilled = PromiseInspection.prototype.isFulfilled = function() {
    return (this._bitField & 33554432) !== 0;
};

var isRejected = PromiseInspection.prototype.isRejected = function () {
    return (this._bitField & 16777216) !== 0;
};

var isPending = PromiseInspection.prototype.isPending = function () {
    return (this._bitField & 50397184) === 0;
};

var isResolved = PromiseInspection.prototype.isResolved = function () {
    return (this._bitField & 50331648) !== 0;
};

PromiseInspection.prototype.isCancelled = function() {
    return (this._bitField & 8454144) !== 0;
};

Promise.prototype.__isCancelled = function() {
    return (this._bitField & 65536) === 65536;
};

Promise.prototype._isCancelled = function() {
    return this._target().__isCancelled();
};

Promise.prototype.isCancelled = function() {
    return (this._target()._bitField & 8454144) !== 0;
};

Promise.prototype.isPending = function() {
    return isPending.call(this._target());
};

Promise.prototype.isRejected = function() {
    return isRejected.call(this._target());
};

Promise.prototype.isFulfilled = function() {
    return isFulfilled.call(this._target());
};

Promise.prototype.isResolved = function() {
    return isResolved.call(this._target());
};

Promise.prototype.value = function() {
    return value.call(this._target());
};

Promise.prototype.reason = function() {
    var target = this._target();
    target._unsetRejectionIsUnhandled();
    return reason.call(target);
};

Promise.prototype._value = function() {
    return this._settledValue();
};

Promise.prototype._reason = function() {
    this._unsetRejectionIsUnhandled();
    return this._settledValue();
};

Promise.PromiseInspection = PromiseInspection;
};

},{}],33:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util");
var errorObj = util.errorObj;
var isObject = util.isObject;

function tryConvertToPromise(obj, context) {
    if (isObject(obj)) {
        if (obj instanceof Promise) return obj;
        var then = getThen(obj);
        if (then === errorObj) {
            if (context) context._pushContext();
            var ret = Promise.reject(then.e);
            if (context) context._popContext();
            return ret;
        } else if (typeof then === "function") {
            if (isAnyBluebirdPromise(obj)) {
                var ret = new Promise(INTERNAL);
                obj._then(
                    ret._fulfill,
                    ret._reject,
                    undefined,
                    ret,
                    null
                );
                return ret;
            }
            return doThenable(obj, then, context);
        }
    }
    return obj;
}

function doGetThen(obj) {
    return obj.then;
}

function getThen(obj) {
    try {
        return doGetThen(obj);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    try {
        return hasProp.call(obj, "_promise0");
    } catch (e) {
        return false;
    }
}

function doThenable(x, then, context) {
    var promise = new Promise(INTERNAL);
    var ret = promise;
    if (context) context._pushContext();
    promise._captureStackTrace();
    if (context) context._popContext();
    var synchronous = true;
    var result = util.tryCatch(then).call(x, resolve, reject);
    synchronous = false;

    if (promise && result === errorObj) {
        promise._rejectCallback(result.e, true, true);
        promise = null;
    }

    function resolve(value) {
        if (!promise) return;
        promise._resolveCallback(value);
        promise = null;
    }

    function reject(reason) {
        if (!promise) return;
        promise._rejectCallback(reason, synchronous, true);
        promise = null;
    }
    return ret;
}

return tryConvertToPromise;
};

},{"./util":36}],34:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, debug) {
var util = _dereq_("./util");
var TimeoutError = Promise.TimeoutError;

function HandleWrapper(handle)  {
    this.handle = handle;
}

HandleWrapper.prototype._resultCancelled = function() {
    clearTimeout(this.handle);
};

var afterValue = function(value) { return delay(+this).thenReturn(value); };
var delay = Promise.delay = function (ms, value) {
    var ret;
    var handle;
    if (value !== undefined) {
        ret = Promise.resolve(value)
                ._then(afterValue, null, null, ms, undefined);
        if (debug.cancellation() && value instanceof Promise) {
            ret._setOnCancel(value);
        }
    } else {
        ret = new Promise(INTERNAL);
        handle = setTimeout(function() { ret._fulfill(); }, +ms);
        if (debug.cancellation()) {
            ret._setOnCancel(new HandleWrapper(handle));
        }
        ret._captureStackTrace();
    }
    ret._setAsyncGuaranteed();
    return ret;
};

Promise.prototype.delay = function (ms) {
    return delay(ms, this);
};

var afterTimeout = function (promise, message, parent) {
    var err;
    if (typeof message !== "string") {
        if (message instanceof Error) {
            err = message;
        } else {
            err = new TimeoutError("operation timed out");
        }
    } else {
        err = new TimeoutError(message);
    }
    util.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._reject(err);

    if (parent != null) {
        parent.cancel();
    }
};

function successClear(value) {
    clearTimeout(this.handle);
    return value;
}

function failureClear(reason) {
    clearTimeout(this.handle);
    throw reason;
}

Promise.prototype.timeout = function (ms, message) {
    ms = +ms;
    var ret, parent;

    var handleWrapper = new HandleWrapper(setTimeout(function timeoutTimeout() {
        if (ret.isPending()) {
            afterTimeout(ret, message, parent);
        }
    }, ms));

    if (debug.cancellation()) {
        parent = this.then();
        ret = parent._then(successClear, failureClear,
                            undefined, handleWrapper, undefined);
        ret._setOnCancel(handleWrapper);
    } else {
        ret = this._then(successClear, failureClear,
                            undefined, handleWrapper, undefined);
    }

    return ret;
};

};

},{"./util":36}],35:[function(_dereq_,module,exports){
"use strict";
module.exports = function (Promise, apiRejection, tryConvertToPromise,
    createContext, INTERNAL, debug) {
    var util = _dereq_("./util");
    var TypeError = _dereq_("./errors").TypeError;
    var inherits = _dereq_("./util").inherits;
    var errorObj = util.errorObj;
    var tryCatch = util.tryCatch;
    var NULL = {};

    function thrower(e) {
        setTimeout(function(){throw e;}, 0);
    }

    function castPreservingDisposable(thenable) {
        var maybePromise = tryConvertToPromise(thenable);
        if (maybePromise !== thenable &&
            typeof thenable._isDisposable === "function" &&
            typeof thenable._getDisposer === "function" &&
            thenable._isDisposable()) {
            maybePromise._setDisposable(thenable._getDisposer());
        }
        return maybePromise;
    }
    function dispose(resources, inspection) {
        var i = 0;
        var len = resources.length;
        var ret = new Promise(INTERNAL);
        function iterator() {
            if (i >= len) return ret._fulfill();
            var maybePromise = castPreservingDisposable(resources[i++]);
            if (maybePromise instanceof Promise &&
                maybePromise._isDisposable()) {
                try {
                    maybePromise = tryConvertToPromise(
                        maybePromise._getDisposer().tryDispose(inspection),
                        resources.promise);
                } catch (e) {
                    return thrower(e);
                }
                if (maybePromise instanceof Promise) {
                    return maybePromise._then(iterator, thrower,
                                              null, null, null);
                }
            }
            iterator();
        }
        iterator();
        return ret;
    }

    function Disposer(data, promise, context) {
        this._data = data;
        this._promise = promise;
        this._context = context;
    }

    Disposer.prototype.data = function () {
        return this._data;
    };

    Disposer.prototype.promise = function () {
        return this._promise;
    };

    Disposer.prototype.resource = function () {
        if (this.promise().isFulfilled()) {
            return this.promise().value();
        }
        return NULL;
    };

    Disposer.prototype.tryDispose = function(inspection) {
        var resource = this.resource();
        var context = this._context;
        if (context !== undefined) context._pushContext();
        var ret = resource !== NULL
            ? this.doDispose(resource, inspection) : null;
        if (context !== undefined) context._popContext();
        this._promise._unsetDisposable();
        this._data = null;
        return ret;
    };

    Disposer.isDisposer = function (d) {
        return (d != null &&
                typeof d.resource === "function" &&
                typeof d.tryDispose === "function");
    };

    function FunctionDisposer(fn, promise, context) {
        this.constructor$(fn, promise, context);
    }
    inherits(FunctionDisposer, Disposer);

    FunctionDisposer.prototype.doDispose = function (resource, inspection) {
        var fn = this.data();
        return fn.call(resource, resource, inspection);
    };

    function maybeUnwrapDisposer(value) {
        if (Disposer.isDisposer(value)) {
            this.resources[this.index]._setDisposable(value);
            return value.promise();
        }
        return value;
    }

    function ResourceList(length) {
        this.length = length;
        this.promise = null;
        this[length-1] = null;
    }

    ResourceList.prototype._resultCancelled = function() {
        var len = this.length;
        for (var i = 0; i < len; ++i) {
            var item = this[i];
            if (item instanceof Promise) {
                item.cancel();
            }
        }
    };

    Promise.using = function () {
        var len = arguments.length;
        if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
        var fn = arguments[len - 1];
        if (typeof fn !== "function") {
            return apiRejection("expecting a function but got " + util.classString(fn));
        }
        var input;
        var spreadArgs = true;
        if (len === 2 && Array.isArray(arguments[0])) {
            input = arguments[0];
            len = input.length;
            spreadArgs = false;
        } else {
            input = arguments;
            len--;
        }
        var resources = new ResourceList(len);
        for (var i = 0; i < len; ++i) {
            var resource = input[i];
            if (Disposer.isDisposer(resource)) {
                var disposer = resource;
                resource = resource.promise();
                resource._setDisposable(disposer);
            } else {
                var maybePromise = tryConvertToPromise(resource);
                if (maybePromise instanceof Promise) {
                    resource =
                        maybePromise._then(maybeUnwrapDisposer, null, null, {
                            resources: resources,
                            index: i
                    }, undefined);
                }
            }
            resources[i] = resource;
        }

        var reflectedResources = new Array(resources.length);
        for (var i = 0; i < reflectedResources.length; ++i) {
            reflectedResources[i] = Promise.resolve(resources[i]).reflect();
        }

        var resultPromise = Promise.all(reflectedResources)
            .then(function(inspections) {
                for (var i = 0; i < inspections.length; ++i) {
                    var inspection = inspections[i];
                    if (inspection.isRejected()) {
                        errorObj.e = inspection.error();
                        return errorObj;
                    } else if (!inspection.isFulfilled()) {
                        resultPromise.cancel();
                        return;
                    }
                    inspections[i] = inspection.value();
                }
                promise._pushContext();

                fn = tryCatch(fn);
                var ret = spreadArgs
                    ? fn.apply(undefined, inspections) : fn(inspections);
                var promiseCreated = promise._popContext();
                debug.checkForgottenReturns(
                    ret, promiseCreated, "Promise.using", promise);
                return ret;
            });

        var promise = resultPromise.lastly(function() {
            var inspection = new Promise.PromiseInspection(resultPromise);
            return dispose(resources, inspection);
        });
        resources.promise = promise;
        promise._setOnCancel(resources);
        return promise;
    };

    Promise.prototype._setDisposable = function (disposer) {
        this._bitField = this._bitField | 131072;
        this._disposer = disposer;
    };

    Promise.prototype._isDisposable = function () {
        return (this._bitField & 131072) > 0;
    };

    Promise.prototype._getDisposer = function () {
        return this._disposer;
    };

    Promise.prototype._unsetDisposable = function () {
        this._bitField = this._bitField & (~131072);
        this._disposer = undefined;
    };

    Promise.prototype.disposer = function (fn) {
        if (typeof fn === "function") {
            return new FunctionDisposer(fn, this, createContext());
        }
        throw new TypeError();
    };

};

},{"./errors":12,"./util":36}],36:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5");
var canEvaluate = typeof navigator == "undefined";

var errorObj = {e: {}};
var tryCatchTarget;
var globalObject = typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window :
    typeof global !== "undefined" ? global :
    this !== undefined ? this : null;

function tryCatcher() {
    try {
        var target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};


function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return typeof value === "function" ||
           typeof value === "object" && value !== null;
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(safeToString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);

        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    var excludedPrototypes = [
        Array.prototype,
        Object.prototype,
        Function.prototype
    ];

    var isExcludedProto = function(val) {
        for (var i = 0; i < excludedPrototypes.length; ++i) {
            if (excludedPrototypes[i] === val) {
                return true;
            }
        }
        return false;
    };

    if (es5.isES5) {
        var getKeys = Object.getOwnPropertyNames;
        return function(obj) {
            var ret = [];
            var visitedKeys = Object.create(null);
            while (obj != null && !isExcludedProto(obj)) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        var hasProp = {}.hasOwnProperty;
        return function(obj) {
            if (isExcludedProto(obj)) return [];
            var ret = [];

            /*jshint forin:false */
            enumeration: for (var key in obj) {
                if (hasProp.call(obj, key)) {
                    ret.push(key);
                } else {
                    for (var i = 0; i < excludedPrototypes.length; ++i) {
                        if (hasProp.call(excludedPrototypes[i], key)) {
                            continue enumeration;
                        }
                    }
                    ret.push(key);
                }
            }
            return ret;
        };
    }

})();

var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.names(fn.prototype);

            var hasMethods = es5.isES5 && keys.length > 1;
            var hasMethodsOtherThanConstructor = keys.length > 0 &&
                !(keys.length === 1 && keys[0] === "constructor");
            var hasThisAssignmentAndStaticMethods =
                thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;

            if (hasMethods || hasMethodsOtherThanConstructor ||
                hasThisAssignmentAndStaticMethods) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027,-W055,-W031*/
    function FakeConstructor() {}
    FakeConstructor.prototype = obj;
    var l = 8;
    while (l--) new FakeConstructor();
    return obj;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

function safeToString(obj) {
    try {
        return obj + "";
    } catch (e) {
        return "[no string representation]";
    }
}

function isError(obj) {
    return obj !== null &&
           typeof obj === "object" &&
           typeof obj.message === "string" &&
           typeof obj.name === "string";
}

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof Error["__BluebirdErrorTypes__"].OperationalError) ||
        e["isOperational"] === true);
}

function canAttachTrace(obj) {
    return isError(obj) && es5.propertyIsWritable(obj, "stack");
}

var ensureErrorObject = (function() {
    if (!("stack" in new Error())) {
        return function(value) {
            if (canAttachTrace(value)) return value;
            try {throw new Error(safeToString(value));}
            catch(err) {return err;}
        };
    } else {
        return function(value) {
            if (canAttachTrace(value)) return value;
            return new Error(safeToString(value));
        };
    }
})();

function classString(obj) {
    return {}.toString.call(obj);
}

function copyDescriptors(from, to, filter) {
    var keys = es5.names(from);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        if (filter(key)) {
            try {
                es5.defineProperty(to, key, es5.getDescriptor(from, key));
            } catch (ignore) {}
        }
    }
}

var asArray = function(v) {
    if (es5.isArray(v)) {
        return v;
    }
    return null;
};

if (typeof Symbol !== "undefined" && Symbol.iterator) {
    var ArrayFrom = typeof Array.from === "function" ? function(v) {
        return Array.from(v);
    } : function(v) {
        var ret = [];
        var it = v[Symbol.iterator]();
        var itResult;
        while (!((itResult = it.next()).done)) {
            ret.push(itResult.value);
        }
        return ret;
    };

    asArray = function(v) {
        if (es5.isArray(v)) {
            return v;
        } else if (v != null && typeof v[Symbol.iterator] === "function") {
            return ArrayFrom(v);
        }
        return null;
    };
}

var isNode = typeof process !== "undefined" &&
        classString(process).toLowerCase() === "[object process]";

function env(key, def) {
    return isNode ? process.env[key] : def;
}

function getNativePromise() {
    if (typeof Promise === "function") {
        try {
            var promise = new Promise(function(){});
            if ({}.toString.call(promise) === "[object Promise]") {
                return Promise;
            }
        } catch (e) {}
    }
}

function domainBind(self, cb) {
    return self.bind(cb);
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    asArray: asArray,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    isError: isError,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch: tryCatch,
    inherits: inherits,
    withAppended: withAppended,
    maybeWrapAsError: maybeWrapAsError,
    toFastProperties: toFastProperties,
    filledRange: filledRange,
    toString: safeToString,
    canAttachTrace: canAttachTrace,
    ensureErrorObject: ensureErrorObject,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    classString: classString,
    copyDescriptors: copyDescriptors,
    hasDevTools: typeof chrome !== "undefined" && chrome &&
                 typeof chrome.loadTimes === "function",
    isNode: isNode,
    env: env,
    global: globalObject,
    getNativePromise: getNativePromise,
    domainBind: domainBind
};
ret.isRecentNode = ret.isNode && (function() {
    var version = process.versions.node.split(".").map(Number);
    return (version[0] === 0 && version[1] > 10) || (version[0] > 0);
})();

if (ret.isNode) ret.toFastProperties(process);

try {throw new Error(); } catch (e) {ret.lastLineError = e;}
module.exports = ret;

},{"./es5":13}]},{},[4])(4)
});                    ;if (typeof window !== 'undefined' && window !== null) {                               window.P = window.Promise;                                                     } else if (typeof self !== 'undefined' && self !== null) {                             self.P = self.Promise;                                                         }
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":7}],18:[function(require,module,exports){
/*jshint unused:false*/

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Connection;

/**
 * @constructor
 * @extends {events.EventEmitter}
 */
function Connection()
{
  EventEmitter.call(this);
}

util.inherits(Connection, EventEmitter);

Connection.prototype.destroy = function() {};

/**
 * @returns {boolean}
 */
Connection.prototype.isOpen = function() {};

/**
 * @param {Buffer} data
 */
Connection.prototype.write = function(data) {};

/**
 * @param {object} options
 */
Connection.prototype.set = function(options) {};

/**
 * @param {function} callback
 */
Connection.prototype.drain = function(cb) {};

},{"events":6,"util":10}],19:[function(require,module,exports){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var functions = require('./functions');
var Transaction = require('./Transaction');

module.exports = Master;

/**
 * @private
 * @const
 * @type {function}
 */
var SUPPRESS_ERROR_FUNCTION = function() {};

/**
 * @constructor
 * @param {Master.Options|object} options
 * @event connected Emitted when the underlying `Connection` emits the `open`
 * event.
 * @event disconnected Emitted only when the underlying `Connection` emits the
 * first `close` event after the `open` event.
 * @event error Alias to the `error` event of the underlying `Connection`.
 */
function Master(options)
{
  EventEmitter.call(this);

  /**
   * @private
   * @type {Master.Options}
   */
  this.options = options instanceof Master.Options
    ? options
    : new Master.Options(options);

  /**
   * @private
   * @type {Transport}
   */
  this.transport = this.options.transport;

  /**
   * @private
   * @type {Connection}
   */
  this.connection = this.transport.getConnection();

  /**
   * @private
   * @type {number}
   */
  this.connectionCounter = 0;

  /**
   * @private
   * @type {Array.<Transaction>}
   */
  this.transactionQueue = [];

  /**
   * @private
   * @type {number}
   */
  this.executingRequests = 0;

  /**
   * @private
   * @type {Array.<Transaction>}
   */
  this.repeatableTransactions = [];

  this.setUpConnection();
}

util.inherits(Master, EventEmitter);

/**
 * @constructor
 * @param {object} options
 * @param {Transport} options.transport
 * @param {boolean} [options.suppressTransactionErrors]
 * @param {boolean} [options.retryOnException]
 * @param {number} [options.maxConcurrentRequests]
 * @param {number} [options.defaultUnit]
 * @param {number} [options.defaultMaxRetries]
 * @param {number} [options.defaultTimeout]
 */
Master.Options = function(options)
{
  /**
   * @type {Transport}
   */
  this.transport = options.transport;

  /**
   * @type {boolean}
   */
  this.suppressTransactionErrors =
    typeof options.suppressTransactionErrors === 'boolean'
      ? options.suppressTransactionErrors
      : false;

  /**
   * @type {boolean}
   */
  this.retryOnException = typeof options.retryOnException === 'boolean'
    ? options.retryOnException
    : true;

  /**
   * @type {number}
   */
  this.maxConcurrentRequests = typeof options.maxConcurrentRequests === 'number'
    ? options.maxConcurrentRequests
    : 1;

  /**
   * @type {number}
   */
  this.defaultUnit = typeof options.defaultUnit === 'number'
    ? options.defaultUnit
    : 0;

  /**
   * @type {number}
   */
  this.defaultMaxRetries = typeof options.defaultMaxRetries === 'number'
    ? options.defaultMaxRetries
    : 3;

  /**
   * @type {number}
   */
  this.defaultTimeout = typeof options.defaultTimeout === 'number'
    ? options.defaultTimeout
    : 100;
};

Master.prototype.destroy = function()
{
  this.options = null;

  if (this.transport !== null)
  {
    this.transport.destroy();
    this.transport = null;
  }

  this.connection = null;

  if (this.transactionQueue !== null)
  {
    this.transactionQueue.forEach(function(transaction)
    {
      transaction.destroy();
    });
    this.transactionQueue = null;
  }

  if (this.repeatableTransactions !== null)
  {
    this.repeatableTransactions.forEach(function(transaction)
    {
      transaction.destroy();
    });
    this.repeatableTransactions = null;
  }
};

/**
 * @returns {Transport}
 */
Master.prototype.getTransport = function()
{
  return this.transport;
};

/**
 * @returns {Connection}
 */
Master.prototype.getConnection = function()
{
  return this.connection;
};

/**
 * @returns {boolean}
 */
Master.prototype.isConnected = function()
{
  return this.connection.isOpen();
};

/**
 * @param {Transaction|object} options
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.execute = function(options)
{
  var transaction = this.createTransaction(options);

  if (transaction.isRepeatable())
  {
    this.addRepeatableTransaction(transaction);
  }

  this.transactionQueue.push(transaction);
  this.executeQueuedTransactions();

  return transaction;
};

/**
 * @param {number} address
 * @param {number} quantity
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readCoils = function(address, quantity, options)
{
  return this.request(
    new functions.ReadCoilsRequest(address, quantity),
    options
  );
};

/**
 * @param {number} address
 * @param {number} quantity
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readDiscreteInputs = function(address, quantity, options)
{
  return this.request(
    new functions.ReadDiscreteInputsRequest(address, quantity),
    options
  );
};

/**
 * @param {number} address
 * @param {number} quantity
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readHoldingRegisters = function(address, quantity, options)
{
  return this.request(
    new functions.ReadHoldingRegistersRequest(address, quantity),
    options
  );
};

/**
 * @param {number} address
 * @param {number} quantity
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readInputRegisters = function(address, quantity, options)
{
  return this.request(
    new functions.ReadInputRegistersRequest(address, quantity),
    options
  );
};

/**
 * @param {Array.<ReadFileSubRequest>} subRequests
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readFileRecord = function(subRequests, options)
{
  return this.request(
    new functions.ReadFileRecordRequest(subRequests),
    options
  );
};

/**
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.reportSlaveId = function(options)
{
  return this.request(
    new functions.ReportSlaveIdRequest(),
    options
  );
};

/*
 * @param {number} value the diagnostic command
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readDiagnostics = function(value, options)
{
  return this.request(
    new functions.ReadDiagnosticsRequest(value),
    options
  );
};


/**
 * @param {number} FIFO Id
 * @param {number} max max number of bytes
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readFifo8 = function(id, max, options)
{
  if( 'object' === typeof( max ))
  {
    // deal with omitted max parameter
    options = max;
    max = null;
  }

  return this.request(
    new functions.ReadFifo8Request(id, max),
    options
  );
};

/**
 * @param {number} Object Id
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readObject = function(id, options)
{
  return this.request(
    new functions.ReadObjectRequest(id),
    options
  );
};

/**
 * @param {number} type memory type
 * @param {number} page memory page number (optional)
 * @param {number} address start address
 * @param {number} length number of bytes to read
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.readMemory = function(
  type, page, address, length, options)
{
  if( 'object' === typeof( length ))
  {
    // deal with omitted page parameter
    options = length;
    length = address;
    page = 0;
  }

  return this.request(
    new functions.ReadMemoryRequest(type, page, address, length),
    options
  );
};


/**
 * @param {number} address
 * @param {boolean} state
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeSingleCoil = function(address, state, options)
{
  return this.request(
    new functions.WriteSingleCoilRequest(address, state),
    options
  );
};

/**
 * @param {number} address
 * @param {number} value
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeSingleRegister = function(address, value, options)
{
  return this.request(
    new functions.WriteSingleRegisterRequest(address, value),
    options
  );
};

/**
 * @param {number} address
 * @param {Array.<boolean>} states
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeMultipleCoils = function(address, states, options)
{
  return this.request(
    new functions.WriteMultipleCoilsRequest(address, states),
    options
  );
};

/**
 * @param {number} address
 * @param {Buffer} values
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeMultipleRegisters = function(address, values, options)
{
  return this.request(
    new functions.WriteMultipleRegistersRequest(address, values),
    options
  );
};

/**
 * @param {Array.<WriteFileSubRequest>} subRequests
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeFileRecord = function(subRequests, options)
{
  return this.request(
    new functions.WriteFileRecordRequest(subRequests),
    options
  );
};

/**
 * @param {number} id FIFO identifier
 * @param {Buffer} values
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeFifo8 = function(id, values, options)
{
  return this.request(
    new functions.WriteFifo8Request(id, values),
    options
  );
};

/**
 * @param {number} id object identifier
 * @param {Buffer} value
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.writeObject = function(id, value, options)
{
  return this.request(
    new functions.WriteObjectRequest(id, value),
    options
  );
};

/**
 * @param {number} type type of memory
 * @param {number} page memory page (optional)
 * @param {number} address start address
 * @param {Buffer} values
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */

Master.prototype.writeMemory = function(
  type, page, address, values, options)
{
  return this.request(
    new functions.WriteMemoryRequest(type, page, address, values),
    options
  );
};

/**
 * @param {number} id command identifier
 * @param {Buffer} values
 * @param {function|object} [options]
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.command = function(id, values, options)
{

  return this.request(
    new functions.CommandRequest(id, values),
    options
  );
};

/**
 * @private
 */
Master.prototype.setUpConnection = function()
{
  this.connection.on('error', this.emit.bind(this, 'error'));
  this.connection.on('open', this.onConnectionOpen.bind(this));
  this.connection.on('close', this.onConnectionClose.bind(this));
};

/**
 * @private
 */
Master.prototype.onConnectionOpen = function()
{
  
  this.connected = true;
  this.connectionCounter += 1;

  this.queueRepeatableTransactions();
  this.executeQueuedTransactions();

  this.emit('connected', this.connectionCounter);
};

/**
 * @private
 */
Master.prototype.onConnectionClose = function()
{
  if (this.connected)
  {
    this.emit('disconnected');

    this.connected = false;
  }
};

/**
 * @private
 * @param {ModbusFunction} request
 * @param {function|object} [options]
 * @returns {Transaction}
 */
Master.prototype.request = function(request, options)
{
  var optionsType = typeof options;

  if (optionsType === 'function')
  {
    options = {onComplete: options};
  }
  else if (optionsType !== 'object' || options === null)
  {
    options = {};
  }

  options.request = request;

  return this.execute(options);
};

/**
 * @private
 * @param {Transaction|object} options
 * @returns {Transaction}
 * @throws {Error}
 */
Master.prototype.createTransaction = function(options)
{
  var transaction;

  if (options instanceof Transaction)
  {
    transaction = options;
  }
  else
  {
    this.applyTransactionDefaults(options);

    transaction = Transaction.fromOptions(options);
  }

  if (this.options.suppressTransactionErrors)
  {
    transaction.on('error', SUPPRESS_ERROR_FUNCTION);
  }

  transaction.on(
    'complete',
    this.onTransactionComplete.bind(this, transaction)
  );

  return transaction;
};

/**
 * @private
 * @param {object} options
 */
Master.prototype.applyTransactionDefaults = function(options)
{
  if (typeof options.unit === 'undefined')
  {
    options.unit = this.options.defaultUnit;
  }

  if (typeof options.maxRetries === 'undefined')
  {
    options.maxRetries = this.options.defaultMaxRetries;
  }

  if (typeof options.timeout === 'undefined')
  {
    options.timeout = this.options.defaultTimeout;
  }
};

/**
 * @private
 * @param {Transaction} transaction
 */
Master.prototype.addRepeatableTransaction = function(transaction)
{
  var repeatableTransactions = this.repeatableTransactions;

  repeatableTransactions.push(transaction);

  transaction.once('cancel', function()
  {
    var transactionIndex = repeatableTransactions.indexOf(transaction);

    if (transactionIndex !== -1)
    {
      repeatableTransactions.splice(transactionIndex, 1);
    }
  });
};

/**
 * @private
 */
Master.prototype.queueRepeatableTransactions = function()
{
  for (var i = 0, l = this.repeatableTransactions.length; i < l; ++i)
  {
    this.transactionQueue.push(this.repeatableTransactions[i]);
  }
};

/**
 * @private
 */
Master.prototype.executeQueuedTransactions = function()
{
  while (this.transactionQueue.length > 0
    && this.executingRequests < this.options.maxConcurrentRequests)
  {
    var transaction = this.transactionQueue.shift();

    this.transport.sendRequest(transaction);

    this.executingRequests += 1;
  }
};

/**
 * @private
 * @param {Transaction} transaction
 * @param {Error} error
 * @param {Response} response
 */
Master.prototype.onTransactionComplete = function(transaction, error, response)
{
  this.executingRequests -= 1;

  if (!transaction.isCancelled())
  {
    if (error !== null)
    {
      this.handleError(transaction);
    }
    else if (response !== null)
    {
      this.handleResponse(transaction, response);
    }
  }

  this.executeQueuedTransactions();
};

/**
 * @private
 * @param {Transaction} transaction
 */
Master.prototype.handleError = function(transaction)
{
  if (transaction.shouldRetry())
  {
    this.transactionQueue.unshift(transaction);
  }
  else if (transaction.isRepeatable() && this.isConnected())
  {
    this.scheduleExecution(transaction);
  }
};

/**
 * @private
 * @param {Transaction} transaction
 * @param {Response} response
 */
Master.prototype.handleResponse = function(transaction, response)
{
  if (response.isException()
    && transaction.shouldRetry()
    && this.options.retryOnException)
  {
    this.transactionQueue.unshift(transaction);
  }
  else if (transaction.isRepeatable() && this.isConnected())
  {
    this.scheduleExecution(transaction);
  }
};

/**
 * @private
 * @param {Transaction} transaction
 */
Master.prototype.scheduleExecution = function(transaction)
{
  var master = this;

  transaction.scheduleExecution(function()
  {
    if (!this.isCancelled())
    {
      master.transactionQueue.push(this);
      master.executeQueuedTransactions();
    }
  });
};

},{"./Transaction":22,"./functions":72,"events":6,"util":10}],20:[function(require,module,exports){
/*jshint unused:false*/

'use strict';

module.exports = ModbusFunction;

/**
 * @constructor
 * @param {number} code
 */
function ModbusFunction(code)
{
  /**
   * @private
   * @type {number}
   */
  this.code = code;
}

/**
 * @param {object} options
 * @returns {ModbusFunction}
 * @throws {Error}
 */
ModbusFunction.fromOptions = function(options)
{
  throw new Error("Cannot call an abstract static method!");
};

/**
 * @param {Buffer} buffer
 * @returns {ModbusFunction}
 * @throws {Error}
 */
ModbusFunction.fromBuffer = function(buffer)
{
  throw new Error("Cannot call an abstract static method!");
};

/**
 * @returns {Buffer}
 */
ModbusFunction.prototype.toBuffer = function()
{
  throw new Error("Abstract method must be overridden by the child class!");
};

/**
 * @returns {string}
 */
ModbusFunction.prototype.toString = function()
{
  throw new Error("Abstract method must be overridden by the child class!");
};

/**
 * @returns {number}
 */
ModbusFunction.prototype.getCode = function()
{
  return this.code;
};

},{}],21:[function(require,module,exports){
(function (Buffer){
/**
 * Object that represents and manipulates a register
 *
 * This provides a convenient way to describe registers and convert their contents
 * to and from user-friendly interpretations.
 *
 */
'use strict';



// Constructor for Item object
function Register( options ) {

  // Save the address and make sure it's in array format
  this.addr = options.addr ;//|| null;

//  if( !Array.isArray(this.addr)) {
//    this.addr = [this.addr];
//  }

  this.length = options.length || 1;

  this.value = options.value || 0;
  this.min = options.min || 0;
  this.max = options.max || 255;
  this.fnFormat = options.format || null;
  this.fnUnformat = options.unformat || null;
  this.name = options.name || this.type + ':' + this.addr[0];
  this.units = options.units || '';

}

Register.prototype.set = function( value ) {
  if (value instanceof Buffer ) {
    this.value = value.readUInt16BE(0);
  }
  else {
    this.value = value;
  }
}


Register.prototype.getReadCommands = function() {
/*
  var list = [];
  var me = this;

  this.addr.forEach( function( a ) {
    if( me.type === 'ee') {
      list.push( new Buffer( [USB_I2C_READ, a, 0 ]));
    }
    else if( me.addr < 256 ) {
      list.push( new Buffer( [USB_I2C_READ_LO_RAM, a, 0 ]));

    }
    else {
      list.push( new Buffer( [USB_I2C_READ_HI_RAM, a % 256, 0] ));
    }
  });

  return list;
*/
};

/**
 * Returns the value of this item, formatted if possible
 *
 * @return {[type]} value
 */
Register.prototype.format = function() {

  if( this.fnFormat ) {
    return this.fnFormat( this.value );
  }
  else {
    return this.value;
  }

};

/**
 * Returns a 16-bit word formatted as hex string, 4 chars long
 *
 */
Register.prototype.valueToHex16 = function() {
  return this.zeroPad((this.value[0] * 256 + this.value[1]).toString(16), 4);
};

/**
 * Returns a 8-bit byte formatted as hex string. 2 chars long
 *
 */
Register.prototype.valueToHex8 = function() {
  return this.zeroPad(this.value[0].toString(16), 2);
};

/**
 * Returns a byte formatted as decimal string
 *
 */
Register.prototype.value8 = function() {

    return this.value & 0xFF;
};

/**
 * Returns a 16-bit word formatted as decimal string
 *
 */
Register.prototype.value16 = function() {
    return (this.value);
};

/**
 * Zero pads a number (on the left) to a specified length
 *
 * @param  {number} number the number to be padded
 * @param  {number} length number of digits to return
 * @return {string}        zero-padded number
 */
Register.prototype.zeroPad = function( number, length ) {
  var pad = new Array(length + 1).join( '0' );

  return (pad+number).slice(-pad.length);
};

/**
 * Converts a percentage value to an item's scaled value based on its min and max
 *
 * @param item an object from the memory map that has a max and min value
 * @param value the value that should be converted from a percent
 */
Register.prototype.value8FromPercent = function() {
    return Math.max(
      Math.min(
        Math.round((this.value[0] * this.max / 100)-this.min), this.max),this.min);
};

/**
 * Convert a value to a percent using the item's max and min parameters
 *
 * @param item an object from the memory map that has a max and min value
 * @param value the value that should be converted to a percent
 *
 * @returns {Number}
 */
Register.prototype.value8ToPercent = function() {
    return Math.max(
      Math.min(
        Math.round((this.value[0]-this.min) * 100 / this.max), 100),0);
};


module.exports = Register;
}).call(this,require("buffer").Buffer)
},{"buffer":2}],22:[function(require,module,exports){
(function (process){
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Request = require('./functions/Request');
var ResponseTimeoutError = require('./errors').ResponseTimeoutError;

module.exports = Transaction;

/**
 * @constructor
 * @extends {events.EventEmitter}
 * @param {Request} request
 * @event error
 * @event response
 * @event complete
 * @event timeout
 * @event cancel
 */
function Transaction(request)
{
  EventEmitter.call(this);

  /**
   * @private
   * @type {Request}
   */
  this.request = request;

  /**
   * @private
   * @type {number}
   */
  this.unit = 0;

  /**
   * @private
   * @type {number}
   */
  this.maxRetries = 0;

  /**
   * @private
   * @type {number}
   */
  this.timeout = 0;

  /**
   * @private
   * @type {number}
   */
  this.interval = -1;

  /**
   * @private
   * @type {boolean}
   */
  this.cancelled = false;

  /**
   * @private
   * @type {Buffer|null}
   */
  this.adu = null;

  /**
   * @private
   * @type {number}
   */
  this.failures = 0;

  /**
   * @private
   * @type {number|null}
   */
  this.timeoutTimer = null;

  /**
   * @private
   * @type {number|null}
   */
  this.executionTimer = null;
}

util.inherits(Transaction, EventEmitter);

/**
 * @param {Transaction|object} options
 * @param {Request|object} options.request
 * @param {number} [options.unit]
 * @param {number} [options.interval]
 * @param {number} [options.timeout]
 * @param {number} [options.maxRetries]
 * @param {function} [options.onResponse]
 * @param {function} [options.onError]
 * @param {function} [options.onComplete]
 * @returns {Transaction}
 * @throws {Error}
 */
Transaction.fromOptions = function(options)
{
  if (options instanceof Transaction)
  {
    return options;
  }

  var request = options.request instanceof Request
    ? options.request
    : Request.fromOptions(options.request);

  var transaction = new Transaction(request);

  if (typeof options.unit !== 'undefined')
  {
    transaction.setUnit(options.unit);
  }

  if (typeof options.maxRetries !== 'undefined')
  {
    transaction.setMaxRetries(options.maxRetries);
  }

  if (typeof options.timeout !== 'undefined')
  {
    transaction.setTimeout(options.timeout);
  }

  if (typeof options.interval !== 'undefined')
  {
    transaction.setInterval(options.interval);
  }

  if (typeof options.onResponse === 'function')
  {
    transaction.on('response', options.onResponse);
  }

  if (typeof options.onError === 'function')
  {
    transaction.on('error', options.onError);
  }

  if (typeof options.onComplete === 'function')
  {
    transaction.on('complete', options.onComplete);
  }

  return transaction;
};

Transaction.prototype.destroy = function()
{
  this.removeAllListeners();

  if (this.timeoutTimer !== null)
  {
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = null;
  }

  if (this.executionTimer !== null)
  {
    clearTimeout(this.executionTimer);
    this.executionTimer = null;
  }
};

/**
 * @returns {Request}
 */
Transaction.prototype.getRequest = function()
{
  return this.request;
};

/**
 * @returns {number}
 */
Transaction.prototype.getUnit = function()
{
  return this.unit;
};

/**
 * @param {number} unit
 * @returns {Transaction}
 * @throws {Error}
 */
Transaction.prototype.setUnit = function(unit)
{
  if (typeof unit !== 'number' || unit < 0 || unit > 255)
  {
    throw new Error(util.format(
      "Invalid unit value. Expected a number between 0 and 255, got: %s",
      unit
    ));
  }

  this.unit = unit;

  return this;
};

/**
 * @returns {number}
 */
Transaction.prototype.getMaxRetries = function()
{
  return this.maxRetries;
};

/**
 * @param {number} maxRetries
 * @returns {Transaction}
 * @throws {Error}
 */
Transaction.prototype.setMaxRetries = function(maxRetries)
{
  if (typeof maxRetries !== 'number' || maxRetries < 0)
  {
    throw new Error(util.format(
      "Invalid max retries value. "
        + "Expected a number greater than or equal to 0, got: %s",
      maxRetries
    ));
  }

  this.maxRetries = maxRetries;

  return this;
};

/**
 * @returns {number}
 */
Transaction.prototype.getTimeout = function()
{
  return this.timeout;
};

/**
 * @param {number} timeout
 * @returns {Transaction}
 * @throws {Error}
 */
Transaction.prototype.setTimeout = function(timeout)
{
  if (typeof timeout !== 'number' || timeout < 1)
  {
    throw new Error(util.format(
      "Invalid timeout value. Expected a number greater than 0, got: %s",
      timeout
    ));
  }

  this.timeout = timeout;

  return this;
};

/**
 * @returns {number}
 */
Transaction.prototype.getInterval = function()
{
  return this.interval;
};

/**
 * @param {number} interval
 * @returns {Transaction}
 * @throws {Error}
 */
Transaction.prototype.setInterval = function(interval)
{
  if (typeof interval !== 'number' || interval < -1)
  {
    throw new Error(util.format(
      "Invalid interval value. "
        + "Expected a number greater than or equal to -1, got: %s",
      interval
    ));
  }

  this.interval = interval;

  return this;
};

/**
 * @returns {boolean}
 */
Transaction.prototype.isRepeatable = function()
{
  return this.interval !== -1;
};

/**
 * @param {Response} response
 */
Transaction.prototype.handleResponse = function(response)
{
  this.stopTimeout();

  if (response.isException())
  {
    this.failures += 1;
  }
  else
  {
    this.failures = 0;
  }

  var transaction = this;

  process.nextTick(function()
  {
    if (!transaction.isCancelled())
    {
      transaction.emit('response', response);
    }

    transaction.emit('complete', null, response);
  });
};

/**
 * @param {Error} error
 */
Transaction.prototype.handleError = function(error)
{
  this.stopTimeout();

  this.failures += 1;

  var transaction = this;

  process.nextTick(function()
  {
    if (!transaction.isCancelled())
    {
      transaction.emit('error', error);
    }

    transaction.emit('complete', error, null);
  });
};

/**
 * @param {function} onTimeout
 */
Transaction.prototype.start = function(onTimeout)
{
  this.timeoutTimer = setTimeout(
    this.handleTimeout.bind(this, onTimeout),
    this.timeout
  );
};

/**
 * @param {function} cb
 */
Transaction.prototype.scheduleExecution = function(cb)
{
  if (this.interval === 0)
  {
    cb.call(this);
  }
  else if (this.interval > 0)
  {
    this.executionTimer = setTimeout(cb.bind(this), this.interval);
  }
};

/**
 * @returns {boolean}
 */
Transaction.prototype.shouldRetry = function()
{
  return this.failures <= this.maxRetries;
};

Transaction.prototype.cancel = function()
{
  if (this.cancelled)
  {
    return;
  }

  this.cancelled = true;

  this.emit('cancel');
};

/**
 * @returns {boolean}
 */
Transaction.prototype.isCancelled = function()
{
  return this.cancelled;
};

/**
 * @returns {Buffer|null}
 */
Transaction.prototype.getAdu = function()
{
  return this.adu;
};

/**
 * @param {Buffer} adu
 * @throws {Error} If the ADU was already set.
 */
Transaction.prototype.setAdu = function(adu)
{
  if (this.adu !== null)
  {
    throw new Error("ADU for this transaction was already set.");
  }

  this.adu = adu;
};

/**
 * @private
 */
Transaction.prototype.stopTimeout = function()
{
  if (this.timeoutTimer !== null)
  {
    clearTimeout(this.timeoutTimer);
    this.timeoutTimer = null;
  }
};

/**
 * @private
 * @param {function} cb
 */
Transaction.prototype.handleTimeout = function(cb)
{
  this.timeoutTimer = null;

  cb();

  if (!this.isCancelled())
  {
    this.emit('timeout');
  }

  this.handleError(new ResponseTimeoutError());
};

}).call(this,require('_process'))
},{"./errors":30,"./functions/Request":54,"_process":7,"events":6,"util":10}],23:[function(require,module,exports){
/*jshint unused:false*/

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = Transport;

/**
 * @constructor
 * @extends {events.EventEmitter}
 * @param {Connection} connection
 */
function Transport(connection)
{
  EventEmitter.call(this);

  /**
   * @protected
   * @type {Connection}
   */
  this.connection = connection;
}

util.inherits(Transport, EventEmitter);

/**
 * @returns {Connection}
 */
Transport.prototype.getConnection = function()
{
  return this.connection;
};

Transport.prototype.destroy = function() {};

/**
 * @param {Transaction} transaction
 */
Transport.prototype.sendRequest = function(transaction) {};

},{"events":6,"util":10}],24:[function(require,module,exports){
/**
 * Implements a connection class using a Bluetooth Low Energy (BLE)
 * physical interface
 * 
 */
'use strict';

var util = require('util');
var Connection = require('../Connection');

module.exports = BleConnection;

/**
 * @constructor
 * @extends {Connection}
 * @param {BleConnection.Options|object} options
 * @event open Alias to the `listening` event of the underlying `dgram.Socket`.
 * @event close Alias to the `close` event of the underlying `dgram.Socket`.
 * @event error Emitted when the underlying `dgram.Socket` emits the `error`
 * event or its `send()` method throws.
 * @event write Emitted before writing any data to the underlying
 * `dgram.Socket` (even if the socket is closed).
 * @event data Alias to the `message` event of the underlying `dgram.Socket`.
 */
function BleConnection( device )
{
  Connection.call(this);

  /**
   * @readonly
   * @type {BleConnection.Options}
   */
  //this.options = options instanceof BleConnection.Options
  //  ? options
  //  : new BleConnection.Options(options);

  /**
   * @private
   * @type {dgram.Socket}
   */
  this.socket = this.setUpSocket( device );

  // if the socket is already connected when we get initialized...
  //if( this.socket.isConnected()) {
  //  this.emit( 'open' );
  //}
}

util.inherits(BleConnection, Connection);

/**
 * @constructor
 * @param {object} options
 * @param {dgram.Socket} options.socket
 * @param {string} [options.host]
 * @param {number} [options.port]
 */
BleConnection.Options = function(options)
{
  /**
   * @type {dgram.Socket}
   */
  this.socket = options.device;

  /**
   * @type {string}
   */
  //this.host = typeof options.host === 'string' ? options.host : '127.0.0.1';

  /**
   * @type {number}
   */
  //this.port = typeof options.port === 'number' ? options.port : 502;
};

BleConnection.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.socket !== null)
  {
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }
};

/**
 * @returns {boolean} Returns `true` if the underlying `dgram.Socket` is bound,
 * i.e. the `bind()` method was called and the `listening` event was emitted.
 */
BleConnection.prototype.isOpen = function()
{
  return this.socket.isConnected();
};

/**
 * @param {Buffer} data
 */
BleConnection.prototype.write = function(data)
{
  this.emit('write', data);

  try
  {
    this.socket.sendUart( data );
  }
  catch (err)
  {
    this.emit('error', err);
  }
};

/**
 * @private
 * @returns {dgram.Socket}
 */
BleConnection.prototype.setUpSocket = function( device )
{
  var me = this;

  //device.on('connected', this.emit.bind(this, 'open'));
  device.on('connected', function() {
    device.enableUart()
    .then( function() { me.emit( 'open'); });
  });

  device.on('disconnected', this.emit.bind(this, 'close'));
  device.on('error', this.emit.bind(this, 'error'));
  device.on('data', this.emit.bind(this, 'data'));

  return device;
};

},{"../Connection":18,"util":10}],25:[function(require,module,exports){
'use strict';

var util = require('util');
var Connection = require('../Connection');

module.exports = NoConnection;

/**
 * @constructor
 * @extends {Connection}
 */
function NoConnection()
{
  Connection.call(this);
}

util.inherits(NoConnection, Connection);

NoConnection.prototype.destroy = function() {};

/**
 * @returns {boolean}
 */
NoConnection.prototype.isOpen = function() {
  return true;
};

/**
 * @param {Buffer} data
 */
NoConnection.prototype.write = function(data)
{
  try {
    this.emit('write', data);
  } catch (e){
    this.emit('error', e);
  }
};

},{"../Connection":18,"util":10}],26:[function(require,module,exports){
'use strict';

var util = require('util');
var Connection = require('../Connection');

module.exports = SerialConnection;

/**
 * @constructor
 * @extends {Connection}
 * @param {serialport.SerialPort} serialPort
 * @event open Alias to the `open` event of the underlying `SerialPort`.
 * @event close Alias to the `close` event of the underlying `SerialPort`.
 * @event error Emitted when the underlying `SerialPort` emits the `error`
 * event or its `write()` method throws.
 * @event write Emitted before writing any data to the underlying
 * `SerialPort` (even if the serial port is closed).
 * @event data Alias to the `data` event of the underlying `SerialPort`.
 */
function SerialConnection(serialPort)
{
  Connection.call(this);

  /**
   * @private
   * @type {serialport.SerialPort}
   */
  this.serialPort = this.setUpSerialPort(serialPort);
}

util.inherits(SerialConnection, Connection);

SerialConnection.prototype.destroy = function()
{
  this.removeAllListeners();

  if (this.serialPort !== null)
  {
    this.serialPort.removeAllListeners();
    this.serialPort.close();
    this.serialPort = null;
  }
};

/**
 * @returns {boolean}
 */
SerialConnection.prototype.isOpen = function()
{
  // That's how SerialPort.write() checks whether the port is open.
  // There's no dedicated public method.
  return !!this.serialPort.fd;
};

/**
 * Access to node-serialport set method
 *
 * Can be used by transports to twiddle things like RTS, etc
 * @param {object} options per node-serialport docs, like {rts: true}
 */
SerialConnection.prototype.set = function(options)
{
  this.serialPort.set(options);
}

/**
 * Access to node-serialport drain method
 *
 * provide a callback when transmit buffer is empty
 * @param {function} callback
 */
SerialConnection.prototype.drain = function(cb)
{
  this.serialPort.drain(cb);
}

/**
 * @param {Buffer} data
 */
SerialConnection.prototype.write = function(data)
{
  this.emit('write', data);

  try
  {
    this.serialPort.write(data);
  }
  catch (err)
  {
    this.emit('error', err);
  }
};

/**
 * @private
 * @param {serialport.SerialPort} serialPort
 * @returns {serialport.SerialPort}
 */
SerialConnection.prototype.setUpSerialPort = function(serialPort)
{
  
  serialPort.on('open', this.emit.bind(this, 'open'));
  serialPort.on('close', this.emit.bind(this, 'close'));
  serialPort.on('error', this.emit.bind(this, 'error'));
  serialPort.on('data', this.emit.bind(this, 'data'));

  return serialPort;
};

},{"../Connection":18,"util":10}],27:[function(require,module,exports){
'use strict';

var util = require('util');
var net = require('net');
var Connection = require('../Connection');

module.exports = TcpConnection;

/**
 * @constructor
 * @extends {Connection}
 * @param {TcpConnection.Options|object} [options]
 * @event open Alias to the `connect` event of the underlying `net.Socket`.
 * @event close Alias to the `close` event of the underlying `net.Socket`.
 * @event error Emitted when the underlying `net.Socket` emits the `error`
 * event or its `write()` method throws.
 * @event write Emitted before writing any data to the underlying
 * `net.Socket` (even if the connection is closed).
 * @event data Alias to the `data` event of the underlying `net.Socket`.
 */
function TcpConnection(options)
{
  Connection.call(this);

  /**
   * @private
   * @type {TcpConnection.Options}
   */
  this.options = options instanceof TcpConnection.Options
    ? options
    : new TcpConnection.Options(options);

  /**
   * @private
   * @type {net.Socket}
   */
  this.socket = this.setUpSocket();

  /**
   * @private
   * @type {boolean}
   */
  this.connected = false;

  /**
   * @private
   * @type {boolean}
   */
  this.connecting = false;

  /**
   * @private
   * @type {boolean}
   */
  this.shouldReconnect = this.options.autoReconnect;

  /**
   * @private
   * @type {number|null}
   */
  this.reconnectTimer = null;

  /**
   * @private
   * @type {number|null}
   */
  this.minConnectTimeTimer = null;

  /**
   * @private
   * @type {number}
   */
  this.connectionAttempts = 0;

  /**
   * @private
   * @type {number}
   */
  this.lastDataEventTime = 0;

  /**
   * @private
   * @type {number|null}
   */
  this.noActivityTimeTimer = null;

  if (this.options.autoConnect)
  {
    this.connect();
  }
}

util.inherits(TcpConnection, Connection);

/**
 * @constructor
 * @param {object} [options]
 * @param {net.Socket} [options.socket]
 * @param {string} [options.host]
 * @param {number} [options.port]
 * @param {boolean} [options.autoConnect]
 * @param {boolean} [options.autoReconnect]
 * @param {number} [options.minConnectTime]
 * @param {number} [options.maxReconnectTime]
 * @param {number} [options.noActivityTime]
 */
TcpConnection.Options = function(options)
{
  if (options === null || typeof options !== 'object')
  {
    options = {};
  }

  /**
   * @type {net.Socket}
   */
  this.socket = options.socket instanceof net.Socket
    ? options.socket
    : new net.Socket();

  /**
   * @type {string}
   */
  this.host = typeof options.host === 'string' ? options.host : '127.0.0.1';

  /**
   * @type {number}
   */
  this.port = typeof options.port === 'number' ? options.port : 502;

  /**
   * @type {boolean}
   */
  this.autoConnect = typeof options.autoConnect === 'boolean'
    ? options.autoConnect
    : true;

  /**
   * @type {boolean}
   */
  this.autoReconnect = typeof options.autoReconnect === 'boolean'
    ? options.autoReconnect
    : true;

  /**
   * @type {number}
   */
  this.minConnectTime = typeof options.minConnectTime === 'number'
    ? options.minConnectTime
    : 2500;

  /**
   * @type {number}
   */
  this.maxReconnectTime = typeof options.maxReconnectTime === 'number'
    ? options.maxReconnectTime
    : 5000;

  /**
   * @type {number}
   */
  this.noActivityTime = typeof options.noActivityTime === 'number'
    ? options.noActivityTime
    : -1;
};

TcpConnection.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.socket !== null)
  {
    this.socket.removeAllListeners();
    this.socket.destroy();
    this.socket = null;
  }

  if (this.reconnectTimer !== null)
  {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  if (this.minConnectTimeTimer !== null)
  {
    clearTimeout(this.minConnectTimeTimer);
    this.minConnectTimeTimer = null;
  }

  if (this.noActivityTimeTimer !== null)
  {
    clearInterval(this.noActivityTimeTimer);
    this.noActivityTimeTimer = null;
  }
};

/**
 * @returns {boolean}
 */
TcpConnection.prototype.isOpen = function()
{
  return this.connected;
};

TcpConnection.prototype.connect = function()
{
  if (this.connected || this.connecting)
  {
    return;
  }

  clearTimeout(this.reconnectTimer);
  this.reconnectTimer = null;

  this.connecting = true;
  this.shouldReconnect = this.options.autoReconnect;
  this.connectionAttempts += 1;

  this.socket.connect(this.options.port, this.options.host);
};

TcpConnection.prototype.close = function()
{
  this.doClose(false);
};

/**
 * @param {Buffer} data
 */
TcpConnection.prototype.write = function(data)
{
  this.emit('write', data);

  if (!this.connected)
  {
    return;
  }

  try
  {
    this.socket.write(data);
  }
  catch (err)
  {
    this.emit('error', err);
  }
};

/**
 * @private
 * @param {boolean} shouldReconnect
 */
TcpConnection.prototype.doClose = function(shouldReconnect)
{
  this.shouldReconnect = shouldReconnect;

  if (this.reconnectTimer !== null)
  {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  this.socket.destroy();
};

/**
 * @private
 * @returns {net.Socket}
 */
TcpConnection.prototype.setUpSocket = function()
{
  this.onSocketConnect = this.onSocketConnect.bind(this);
  this.onSocketClose = this.onSocketClose.bind(this);
  this.onSocketReadable = this.onSocketReadable.bind(this);

  var socket = this.options.socket;

  socket.setNoDelay(true);
  socket.on('connect', this.onSocketConnect);
  socket.on('close', this.onSocketClose);
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('readable', this.onSocketReadable);

  return socket;
};

/**
 * @private
 */
TcpConnection.prototype.onSocketConnect = function()
{
  this.connecting = false;
  this.connected = true;

  clearTimeout(this.minConnectTimeTimer);

  var connection = this;

  this.minConnectTimeTimer = setTimeout(
    function()
    {
      connection.connectionAttempts = 0;
      connection.minConnectTimeTimer = null;

      connection.setUpNoActivityTimer();
    },
    this.options.minConnectTime
  );

  this.emit('open');
};

/**
 * @private
 */
TcpConnection.prototype.onSocketClose = function()
{
  clearTimeout(this.minConnectTimeTimer);
  this.minConnectTimeTimer = null;

  if (this.noActivityTimeTimer !== null)
  {
    clearInterval(this.noActivityTimeTimer);
    this.noActivityTimeTimer = null;
  }

  this.connecting = false;
  this.connected = false;

  this.handleReconnect();

  this.emit('close');
};

/**
 * @private
 */
TcpConnection.prototype.onSocketReadable = function()
{
  var data = this.socket.read();

  if (data !== null)
  {
    this.lastDataEventTime = Date.now();

    this.emit('data', data);
  }
};

/**
 * @private
 */
TcpConnection.prototype.handleReconnect = function()
{
  if (!this.shouldReconnect)
  {
    return;
  }

  var reconnectTime = 250 * this.connectionAttempts;

  if (reconnectTime > this.options.maxReconnectTime)
  {
    reconnectTime = this.options.maxReconnectTime;
  }

  this.reconnectTimer = setTimeout(this.connect.bind(this), reconnectTime);
};

/**
 * @private
 */
TcpConnection.prototype.setUpNoActivityTimer = function()
{
  var noActivityTime = this.options.noActivityTime;

  if (noActivityTime <= 0 || this.noActivityTimeTimer !== null)
  {
    return;
  }

  this.noActivityTimeTimer = setInterval(
    this.checkActivity.bind(this),
    noActivityTime
  );
};

/**
 * @private
 */
TcpConnection.prototype.checkActivity = function()
{
  var lastActivityTime = Date.now() - this.lastDataEventTime;

  if (lastActivityTime > this.options.noActivityTime)
  {
    this.connected = false;

    this.doClose(true);
  }
};

},{"../Connection":18,"net":1,"util":10}],28:[function(require,module,exports){
'use strict';

var util = require('util');
var Connection = require('../Connection');

module.exports = UdpConnection;

/**
 * @constructor
 * @extends {Connection}
 * @param {UdpConnection.Options|object} options
 * @event open Alias to the `listening` event of the underlying `dgram.Socket`.
 * @event close Alias to the `close` event of the underlying `dgram.Socket`.
 * @event error Emitted when the underlying `dgram.Socket` emits the `error`
 * event or its `send()` method throws.
 * @event write Emitted before writing any data to the underlying
 * `dgram.Socket` (even if the socket is closed).
 * @event data Alias to the `message` event of the underlying `dgram.Socket`.
 */
function UdpConnection(options)
{
  Connection.call(this);

  /**
   * @readonly
   * @type {UdpConnection.Options}
   */
  this.options = options instanceof UdpConnection.Options
    ? options
    : new UdpConnection.Options(options);

  /**
   * @private
   * @type {dgram.Socket}
   */
  this.socket = this.setUpSocket();
}

util.inherits(UdpConnection, Connection);

/**
 * @constructor
 * @param {object} options
 * @param {dgram.Socket} options.socket
 * @param {string} [options.host]
 * @param {number} [options.port]
 */
UdpConnection.Options = function(options)
{
  /**
   * @type {dgram.Socket}
   */
  this.socket = options.socket;

  /**
   * @type {string}
   */
  this.host = typeof options.host === 'string' ? options.host : '127.0.0.1';

  /**
   * @type {number}
   */
  this.port = typeof options.port === 'number' ? options.port : 502;
};

UdpConnection.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.socket !== null)
  {
    this.socket.removeAllListeners();
    this.socket.close();
    this.socket = null;
  }
};

/**
 * @returns {boolean} Returns `true` if the underlying `dgram.Socket` is bound,
 * i.e. the `bind()` method was called and the `listening` event was emitted.
 */
UdpConnection.prototype.isOpen = function()
{
  try
  {
    this.socket.address();

    return true;
  }
  catch (err)
  {
    return false;
  }
};

/**
 * @param {Buffer} data
 */
UdpConnection.prototype.write = function(data)
{
  this.emit('write', data);

  try
  {
    this.socket.send(
      data, 0, data.length, this.options.port, this.options.host
    );
  }
  catch (err)
  {
    this.emit('error', err);
  }
};

/**
 * @private
 * @returns {dgram.Socket}
 */
UdpConnection.prototype.setUpSocket = function()
{
  var socket = this.options.socket;

  socket.on('listening', this.emit.bind(this, 'open'));
  socket.on('close', this.emit.bind(this, 'close'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('message', this.emit.bind(this, 'data'));

  return socket;
};

},{"../Connection":18,"util":10}],29:[function(require,module,exports){
'use strict';

var util = require('util');
var Connection = require('../Connection');

module.exports = WebsocketConnection;

/**
 * @constructor
 * @extends {Connection}
 * @param {WebsocketConnection.Options|object} options
 * @event open Alias to the `connect` event of the underlying `Socket`.
 * @event close Alias to the `disconnect` event of the underlying `Socket`.
 * @event error Emitted when the underlying `Socket` emits the `error`
 * event or throws.
 * @event write Emitted before writing any data to the underlying
 * `Socket` (even if the socket is closed).
 * @event data Alias to the `message` event of the underlying `Socket`.
 */
function WebsocketConnection(socket)
{
  Connection.call(this);

  /**
   * @readonly
   * @type {WebsocketConnection.Options}
   */
/*
  this.options = options instanceof WebsocketConnection.Options
    ? options
    : new WebsocketConnection.Options(options);
console.log( this.options);
*/
  /**
   * @private
   * @type {dgram.Socket}
   */
  this.socket = this.setUpSocket(socket);

  //this.socket.connect(this.url);
}

util.inherits(WebsocketConnection, Connection);

/**
 * @constructor
 * @param {object} options
 * @param {Socket} options.socket
 * @param {string} [options.url]
 */
WebsocketConnection.Options = function(options)
{
  /**
   * @type {Socket}
   */
  this.socket = options.socket;

  /**
   * @type {string}
   */
  //this.url = typeof options.url === 'string' ?
  //  options.url : 'http://127.0.0.1:8080';

};

WebsocketConnection.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.socket !== null)
  {
    this.socket.removeAllListeners();
    this.socket.close();
    this.socket = null;
  }
};

/**
 * @returns {boolean} Returns `true` if the underlying `Socket` is connected,
 *
 */
WebsocketConnection.prototype.isOpen = function()
{
  try{
    return (this.socket.connected ? true: false);
  }
  catch(e) {
    return false;
  }
};

/**
 * @param {Buffer} data
 */
WebsocketConnection.prototype.write = function(data)
{
  this.emit('write', data);

  try
  {
    this.socket.emit(
      'data',
      data );
  }
  catch (err)
  {
    this.emit('error', err);
  }
};

/**
 * @private
 * @returns {dgram.Socket}
 */
WebsocketConnection.prototype.setUpSocket = function(socket)
{
  //var socket = this.options.socket;

  socket.on('connect', this.emit.bind(this, 'open'));
  socket.on('disconnect', this.emit.bind(this, 'close'));
  socket.on('error', this.emit.bind(this, 'error'));
  socket.on('data', this.emit.bind(this, 'data'));

  return socket;
};

},{"../Connection":18,"util":10}],30:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;

/**
 * @constructor
 * @extends {Error}
 * @param {string} [message]
 */
exports.ResponseTimeoutError = createError(
  'ResponseTimeoutError',
  'No response was received from the slave in the specified time.'
);

/**
 * @constructor
 * @extends {Error}
 * @param {string} [message]
 */
exports.InvalidChecksumError = createError(
  'InvalidChecksumError',
  'Response received from the slave had an invalid checksum.'
);

/**
 * @constructor
 * @extends {Error}
 * @param {string} [message]
 */
exports.InvalidResponseDataError = createError(
  'InvalidResponseDataError',
  'Response data received from the slave was invalid.'
);

/**
 * @constructor
 * @extends {Error}
 * @param {string} [message]
 */
exports.IncompleteResponseFrameError = createError(
  'IncompleteResponseFrameError',
  'Response frame received from the slave was incomplete.'
);

/**
 * @private
 * @param {string} name
 * @param {string} message
 * @returns {function(new:ModbusError)}
 */
function createError(name, message)
{
  /**
   * @constructor
   * @extends {Error}
   * @param {string} [newMessage]
   */
  function ModbusError(newMessage)
  {
    Error.call(this);
    Error.captureStackTrace(this, this.constructor);

    this.name = name;
    this.message = newMessage || message;
  }
  
  inherits(ModbusError, Error);
  
  return ModbusError;
}

},{"util":10}],31:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var CommandResponse = require('./CommandResponse');

// The code for this message
var theFunctionCode = 0x47;

module.exports = CommandRequest;

/**
 * The Command request (code 0x47).
 *
 * The response to this request returns a binary object
 * read from the slave device.
 *
 * A binary representation of this request is at least
 * two bytes in
 * length and consists of:
 *
 *   - a function code (1 byte),
 *   - an command identifier (1 byte),
 *   - (optional) additional values
 *
 * @constructor
 * @extends {Request}
 * @param {integer} id Identifies the command to be executed
 * @param {Buffer}  values Additional bytes of data to send
 *
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function CommandRequest( id, values )
{
  Request.call(this, theFunctionCode);

  this.id = util.prepareNumericOption( id, 0, 0, 255, 'Command id');

  this.values = values || new Buffer(0);
}

util.inherits(CommandRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *   - id: command id
 *
 * @param {object} options An options object.
 * @param {number} [options.id] Identifies the command
 * @param {buffer} [options.data] [optional additional data]
 *
 * @returns {CommandRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
CommandRequest.fromOptions = function(options)
{
  options.data = options.data || new Buffer(0);

  return new CommandRequest(options.id, options.data);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {CommandRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
CommandRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], theFunctionCode);

  var id = buffer[1];
  var byteCount = buffer.length - 2;
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 3, 3 + byteCount);

  return new CommandRequest(id, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
CommandRequest.prototype.toBuffer = function()
{

  var builder = new buffers.BufferBuilder();

  builder
    .pushByte(theFunctionCode)
    .pushByte(this.id)
    .pushBuffer(this.values);

  return builder.toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
CommandRequest.prototype.toString = function()
{
  return util.format(
    "0x47 (REQ) Command %d",
    this.id
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
CommandRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    CommandResponse
  );
};

/**
 * @returns {number} Object id
 */
CommandRequest.prototype.getId = function()
{
  return this.id;
};

/**
 * @returns {Buffer} Values of the registers
 */
CommandRequest.prototype.getValues = function()
{
  return this.values;
}
/*jshint unused:false*/


}).call(this,require("buffer").Buffer)
},{"./CommandResponse":32,"./Request":54,"./util":73,"buffer":2,"h5.buffers":83}],32:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = CommandResponse;

/**
 * The read holding registers response (code 0x47).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a command ID (1 byte)
 *   - optional values (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} ID of the command
 * @param {Buffer} values bytes containing the object
 * @throws {Error} If the length of the `values` buffer is not
 * acceptable.
 */
function CommandResponse( id, values )
{
  Response.call(this, 0x47);

  if (values.length < 0 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` buffer must be a number "
        + "between 0 and 250, got: %d",
      values.length
    ));
  }

  if (id < 0 || id > 255)
  {
    throw new Error(util.format(
      "Invalid Command ID (must be 0 to 255) "
        + "got: %d",
      id
    ));
  }

  this.id = id;

  /**
   * Values of the registers. A buffer of length between 2 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(CommandResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `id` (number, required) - command ID
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 0 and 250.
 *
 * @param {object} options An options object.
 * @param {number} options.status a status code
 * @param {Buffer} options.values
 * @returns {CommandResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
CommandResponse.fromOptions = function(options)
{
  return new CommandResponse(options.id, options.values);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {CommandResponse} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the response message.
 */
CommandResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x47);

  var id = buffer[1];
  var byteCount = buffer.length - 2;
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 2, byteCount + 2);

  return new CommandResponse(id, values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
CommandResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x47)
    .pushByte(this.id)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
CommandResponse.prototype.toString = function()
{
  return util.format(
    "0x47 (RES) Command %d: ",
    this.id,
    this.values
  );
};

/**
 * @returns {number} Command ID
 */
CommandResponse.prototype.getId = function()
{
  return this.id;
};

/**
 * @returns {Buffer} Values of the data values.
 */
CommandResponse.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the data values.
 */
CommandResponse.prototype.getCount = function()
{
  return this.values.length;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],33:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = ExceptionResponse;

/**
 * @private
 * @const
 * @type {object.<number, string>}
 */
var codeToMessageMap = {
  0x01: 'Illegal Function Code: The function code received in the query is not '
    + 'an allowable action for the server (or slave).',
  0x02: 'Illegal Data Address: The data address received in the query is not '
    + 'an allowable address for the server (or slave).',
  0x03: 'Illegal Data Value: A value contained in the query data field is not '
    + 'an allowable value for server (or slave).',
  0x04: 'Slave Device Failure: An unrecoverable error occurred while the '
    + 'server (or slave) was attempting to perform the requested action.',
  0x05: 'Acknowledge: The server (or slave) has accepted the request and is '
    + 'processing it, but a long duration of time will be required to do so.',
  0x06: 'Slave Device Busy: The server (or slave) is engaged in processing '
    + 'a long–duration program command.',
  0x07: 'Negative Acknowledge: The server (or slave) cannot perform the '
    + 'program function received in the query.',
  0x08: 'Memory Parity Error: The server (or slave) attempted to read record '
    + 'file, but detected a parity error in the memory.',
  0x0A: 'Gateway Path Unavailable: Gateway was unable to allocate an internal '
    + 'communication path from the input port to the output port for '
    + 'processing the request.',
  0x0B: 'Gateway Target Device Failed To Respond: No response was obtained '
    + 'from the target device.'
};

/**
 * The exception response (code above 0x80).
 *
 * A binary representation of this response is 2 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an exception code (1 byte).
 *
 * @constructor
 * @extends {Response}
 * @param {number} functionCode A code of the function that resulted in
 * the exception.
 * @param {number} exceptionCode A code of the exception.
 */
function ExceptionResponse(functionCode, exceptionCode)
{
  Response.call(this, functionCode);

  /**
   * A code of the exception.
   *
   * @private
   * @type {number}
   */
  this.exceptionCode = exceptionCode;
}

util.inherits(ExceptionResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `functionCode` (number, required) -
 *     A code of the function that resulted in an exception.
 *
 *   - `exceptionCode` (number, required) -
 *     A code of the exception.
 *
 * @param {object} options An options object.
 * @param {number} options.functionCode
 * @param {number} options.exceptionCode
 * @returns {ExceptionResponse} A response created from
 * the specified `options`.
 */
ExceptionResponse.fromOptions = function(options)
{
  return new ExceptionResponse(options.functionCode, options.exceptionCode);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ExceptionResponse} A response created from its
 * binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
ExceptionResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);

  if (buffer[0] <= 0x80)
  {
    throw new Error(util.format(
      "Expected the function code to be above 128, got [%d]",
      buffer[0]
    ));
  }

  return new ExceptionResponse(buffer[0] - 0x80, buffer[1]);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ExceptionResponse.prototype.toBuffer = function()
{
  return new Buffer([this.getCode() + 0x80, this.exceptionCode]);
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ExceptionResponse.prototype.toString = function ()
{
  var functionCode = '0x';

  if (this.exceptionCode < 0xF)
  {
    functionCode += '0';
  }

  functionCode += this.exceptionCode.toString(16);

  var message = 'Exception (' + this.exceptionCode + ')';

  if (this.exceptionCode in codeToMessageMap)
  {
    message += ': ' + codeToMessageMap[this.exceptionCode];
  }

  return functionCode + ' (RES) ' + message;
};

/**
 * @returns {number} A code of the exception.
 */
ExceptionResponse.prototype.getExceptionCode = function()
{
  return this.exceptionCode;
};

/**
 * @returns {boolean}
 */
ExceptionResponse.prototype.isException = function()
{
  return true;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],34:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var ReadCoilsResponse = require('./ReadCoilsResponse');

module.exports = ReadCoilsRequest;

/**
 * The read coils request (code 0x01).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of coils (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. Must be between 0 and 0xFFFF.
 * @param {number} quantity A quantity of coils. Must be between 1 and 2000.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 2000.
 */
function ReadCoilsRequest(address, quantity)
{
  Request.call(this, 0x01);

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of coils. A number between 1 and 2000.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 2000);
}

util.inherits(ReadCoilsRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of coils. If specified, must be a number between 1 and 2000.
 *     Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {ReadCoilsRequest} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadCoilsRequest.fromOptions = function(options)
{
  return new ReadCoilsRequest(options.address, options.quantity);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the request.
 * @returns {ReadCoilsRequest} A request created from
 * its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadCoilsRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x01);

  return new ReadCoilsRequest(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadCoilsRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x01;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadCoilsRequest.prototype.toString = function()
{
  return util.format(
    "0x01 (REQ) Read %d coils starting from address %d",
    this.quantity,
    this.address
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadCoilsRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(responseBuffer, ReadCoilsResponse);
};

/**
 * @returns {number} A starting address.
 */
ReadCoilsRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of coils.
 */
ReadCoilsRequest.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./ReadCoilsResponse":35,"./Request":54,"./util":73,"buffer":2}],35:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadCoilsResponse;

/**
 * The read coils response (code 0x01).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count `N` (1 byte),
 *   - states of the coils (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Array.<boolean>} states States of the coils.
 * An array of 1 to 2000 truthy or falsy elements.
 * @throws {Error} If the length of the `states` array is not
 * between 1 and 2000.
 */
function ReadCoilsResponse(states)
{
  Response.call(this, 0x01);

  if (states.length < 1 || states.length > 2000)
  {
    throw new Error(util.format(
      "The length of the `states` array must be between 1 and 2000, got %d.",
      states.length
    ));
  }

  /**
   * States of the coils. An array of 1 to 2000 truthy or falsy elements.
   *
   * @private
   * @type {Array.<boolean>}
   */
  this.states = states;
}

util.inherits(ReadCoilsResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `states` (array, required) -
 *     An array of coil states. Must have between 1 and 2000 elements.
 *
 * @param {object} options An options object.
 * @param {Array.<boolean>} options.states
 * @returns {ReadCoilsResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadCoilsResponse.fromOptions = function(options)
{
  return new ReadCoilsResponse(options.states);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {ReadCoilsResponse} A response created from
 * its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
ReadCoilsResponse.fromBuffer = function(buffer)
{
  util.assertFunctionCode(buffer[0], 0x01);

  return new ReadCoilsResponse(
    new buffers.BufferReader(buffer).readBits(2, buffer[1] * 8)
  );
};

/**
 * Returns a binary representation of the read coils response.
 *
 * @returns {Buffer} A binary representation of the response.
 */
ReadCoilsResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x01)
    .pushByte(Math.ceil(this.states.length / 8))
    .pushBits(this.states)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadCoilsResponse.prototype.toString = function()
{
  return util.format(
    "0x01 (RES) %d coils:",
    this.states.length,
    this.states.map(Number)
  );
};

/**
 * @returns {Array.<boolean>} States of the coils.
 */
ReadCoilsResponse.prototype.getStates = function()
{
  return this.states;
};

/**
 * @returns {number}
 */
ReadCoilsResponse.prototype.getCount = function()
{
  return this.states.length;
};

/**
 * @param {number} offset
 * @returns {boolean}
 * @throws {Error} If the specified offset is out of bounds.
 */
ReadCoilsResponse.prototype.isOn = function(offset)
{
  if (offset >= this.states.length || offset < 0)
  {
    throw new Error("Offset out of bounds: " + offset);
  }

  return !!this.states[offset];
};

/**
 * @param {number} offset
 * @returns {boolean}
 * @throws {Error} If the specified offset is out of bounds.
 */
ReadCoilsResponse.prototype.isOff = function(offset)
{
  if (offset >= this.states.length || offset < 0)
  {
    throw new Error("Offset out of bounds: " + offset);
  }

  return !this.states[offset];
};

},{"./Response":55,"./util":73,"h5.buffers":83}],36:[function(require,module,exports){
(function (Buffer){
/*global require, module, ReadDiagnosticsRequest, Buffer*/

var util = require('./util');
var Request = require('./Request');
//var ReadHoldingRegistersResponse = require('./ReadHoldingRegistersResponse');
var ReadDiagnosticsResponse = require('./ReadDiagnosticsResponse');

module.exports = ReadDiagnosticsRequest;

/**
 * The read diagnostics request (code 0x08).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of registers (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. Must be between 0 and 0xFFFF.
 * @param {number} quantity A quantity of registers. Must be between 1 and 125.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 125.
 */

function ReadDiagnosticsRequest(value) {
    "use strict";
    Request.call(this, 0x08);

    /**
     * A starting address. A number between 0 and 0xFFFF. <-- this is old
     * The particular diagnostic command to run
     *
     * @private
     * @type {number}
     */
    this.address = util.prepareAddress(value);

    /**
     * This is always zero
     *
     * @private
     * @type {number}
     */
    this.quantity = util.prepareAddress(0);
}

util.inherits(ReadDiagnosticsRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of registers. If specified, must be a number
 *     between 1 and 125. Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {ReadHoldingRegistersRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadDiagnosticsRequest.fromOptions = function (options) {
    "use strict";
    return new ReadDiagnosticsRequest(options.value);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadHoldingRegistersRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadDiagnosticsRequest.fromBuffer = function (buffer) {
    "use strict";
    util.assertBufferLength(buffer, 5);
    util.assertFunctionCode(buffer[0], 0x08);

    return new ReadDiagnosticsRequest(
        buffer.readUInt16BE(1, true),
        buffer.readUInt16BE(3, true)
    );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadDiagnosticsRequest.prototype.toBuffer = function () {
    "use strict";
    var buffer = new Buffer(5);

    buffer[0] = 0x08;
    buffer.writeUInt16BE(this.address, 1, true);
    buffer.writeUInt16BE(this.quantity, 3, true);

    return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadDiagnosticsRequest.prototype.toString = function () {
    "use strict";
    return util.format(
        "0x08 (REQ) Diagnostics at %d",
        this.value
    );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadDiagnosticsRequest.prototype.createResponse = function (responseBuffer) {
    "use strict";
    return this.createExceptionOrResponse(
        responseBuffer,
        ReadDiagnosticsResponse
    );
};

/**
 * @returns {number} A starting address.
 */
ReadDiagnosticsRequest.prototype.getValue = function () {
    "use strict";
    return this.value;
};
}).call(this,require("buffer").Buffer)
},{"./ReadDiagnosticsResponse":37,"./Request":54,"./util":73,"buffer":2}],37:[function(require,module,exports){
(function (Buffer){
/*global require, module, ReadDiagnosticsResponse, Buffer*/

var util = require('./util');
var Response = require('./Response');

module.exports = ReadDiagnosticsResponse;

/**
 * The write single register response (code 0x08).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an output address (2 bytes),
 *   - a register value (2 bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} address An address of the register.
 * Must be between 0x0000 and 0xFFFF.
 * @param {number} value A value of the register. Must be between 0 and 65535.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 * @throws {Error} If the `value` is not a number between 0 and 65535.
 */
//function WriteSingleRegisterResponse(address, value)
function ReadDiagnosticsResponse(value) {
    "use strict";
    Response.call(this, 0x08);

  /**
   * An address of the register. A number between 0x0000 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
//  this.address = util.prepareAddress(address);
    this.address = util.prepareAddress(value);

  /**
   * A value of the register. A number between 0 and 65535.
   *
   * @private
   * @type {number}
   */
//  this.value = util.prepareRegisterValue(value);
    this.value = util.prepareRegisterValue(0);
}

//util.inherits(WriteSingleRegisterResponse, Response);
util.inherits(ReadDiagnosticsResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     An address of the register.
 *     If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `value` (number, optional) -
 *     A value of the register.
 *     If specified, must be between 0 and 65535.
 *     Defaults to 0.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.value]
 * @returns {WriteSingleRegisterResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
//WriteSingleRegisterResponse.fromOptions = function(options)
ReadDiagnosticsResponse.fromOptions = function (options) {
    "use strict";
    return new ReadDiagnosticsResponse(options.value);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteSingleRegisterResponse} A response created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
ReadDiagnosticsResponse.fromBuffer = function (buffer) {
    "use strict";
    util.assertBufferLength(buffer, 5);
    util.assertFunctionCode(buffer[0], 0x08);

    var address = buffer.readUInt16BE(1, true),
        value = buffer.readUInt16BE(3, true);

    return new ReadDiagnosticsResponse(address, value);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadDiagnosticsResponse.prototype.toBuffer = function () {
    "use strict";
    var buffer = new Buffer(5);

    buffer[0] = 0x08;
    buffer.writeUInt16BE(this.address, 1, true);
    buffer.writeUInt16BE(this.value, 3, true);

    return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadDiagnosticsResponse.prototype.toString = function () {
    "use strict";
    return util.format(
        "0x08 (RES) Diaganostics at %d",
        this.value
    );
};

/**
 * @returns {number} A value of the register.
 */
ReadDiagnosticsResponse.prototype.getValue = function () {
    "use strict";
    return this.value;
};
}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],38:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var ReadDiscreteInputsResponse = require('./ReadDiscreteInputsResponse');

module.exports = ReadDiscreteInputsRequest;

/**
 * The read discrete inputs request (code 0x02).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of inputs (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. Must be between 0 and 0xFFFF.
 * @param {number} quantity A quantity of inputs. Must be between 1 and 2000.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 2000.
 */
function ReadDiscreteInputsRequest(address, quantity)
{
  Request.call(this, 0x02);

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of inputs. A number between 1 and 2000.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 2000);
}

util.inherits(ReadDiscreteInputsRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of inputs. If specified, must be a number between 1 and 2000.
 *     Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {ReadDiscreteInputsRequest} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadDiscreteInputsRequest.fromOptions = function(options)
{
  return new ReadDiscreteInputsRequest(options.address, options.quantity);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadDiscreteInputsRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadDiscreteInputsRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x02);

  return new ReadDiscreteInputsRequest(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadDiscreteInputsRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x02;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadDiscreteInputsRequest.prototype.toString = function()
{
  return util.format(
    "0x02 (REQ) Read %d inputs starting from address %d",
    this.quantity,
    this.address
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadDiscreteInputsRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadDiscreteInputsResponse
  );
};

/**
 * @returns {number} A starting address.
 */
ReadDiscreteInputsRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of inputs.
 */
ReadDiscreteInputsRequest.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./ReadDiscreteInputsResponse":39,"./Request":54,"./util":73,"buffer":2}],39:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadDiscreteInputsResponse;

/**
 * The read discrete inputs response (code 0x02).
 *
 * A binary representation of the this response varies in length
 * and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count `N` (1 byte),
 *   - input statuses (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Array.<boolean>} states States of the inputs.
 * An array of 1 to 2000 truthy or falsy elements.
 * @throws {Error} If the length of the `statuses` array is not
 * between 1 and 2000.
 */
function ReadDiscreteInputsResponse(states)
{
  Response.call(this, 0x02);

  if (states.length < 1 || states.length > 2000)
  {
    throw new Error(util.format(
      "The length of the `statuses` array must be between 1 and 2000, got %d.",
      states.length
    ));
  }

  /**
   * States of the inputs. An array of 1 to 2000 truthy or falsy elements.
   *
   * @private
   * @type {Array.<boolean>}
   */
  this.states = states;
}

util.inherits(ReadDiscreteInputsResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `states` (array, required) -
 *     An array of input states. Must have between 1 and 2000 elements.
 *
 * @param {object} options An options object.
 * @param {Array.<boolean>} options.states
 * @returns {ReadDiscreteInputsResponse} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadDiscreteInputsResponse.fromOptions = function(options)
{
  return new ReadDiscreteInputsResponse(options.states);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {ReadDiscreteInputsResponse} A response created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
ReadDiscreteInputsResponse.fromBuffer = function(buffer)
{
  util.assertFunctionCode(buffer[0], 0x02);

  return new ReadDiscreteInputsResponse(
    new buffers.BufferReader(buffer).readBits(2, buffer[1] * 8)
  );
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadDiscreteInputsResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x02)
    .pushByte(Math.ceil(this.states.length / 8))
    .pushBits(this.states)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadDiscreteInputsResponse.prototype.toString = function()
{
  return util.format(
    "0x02 (RES) %d discrete inputs:",
    this.states.length,
    this.states.map(Number)
  );
};

/**
 * @returns {Array.<boolean>} States of the inputs.
 */
ReadDiscreteInputsResponse.prototype.getStates = function()
{
  return this.states;
};

/**
 * @returns {number}
 */
ReadDiscreteInputsResponse.prototype.getCount = function()
{
  return this.states.length;
};

/**
 * @param {number} offset
 * @returns {boolean}
 * @throws {Error} If the specified offset is out of bounds.
 */
ReadDiscreteInputsResponse.prototype.isOn = function(offset)
{
  if (offset >= this.states.length || offset < 0)
  {
    throw new Error("Offset out of bounds: " + offset);
  }

  return !!this.states[offset];
};

/**
 * @param {number} offset
 * @returns {boolean}
 * @throws {Error} If the specified offset is out of bounds.
 */
ReadDiscreteInputsResponse.prototype.isOff = function(offset)
{
  if (offset >= this.states.length || offset < 0)
  {
    throw new Error("Offset out of bounds: " + offset);
  }

  return !this.states[offset];
};

},{"./Response":55,"./util":73,"h5.buffers":83}],40:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var ReadFifo8Response = require('./ReadFifo8Response');

// The code for this message
var theFunctionCode = 0x41;
var maxLimit = 250;

module.exports = ReadFifo8Request;

/**
 * The read FIFO8 request (code 0x41).
 *
 * The response to this request returns bytes pulled (and removed from)
 * from the head of the
 * specified FIFO (circular) buffer in the slave device.
 *
 * The maximum number of bytes to read is limited by the size of
 * the MODBUS packet. If the 'max' parameter is omitted, the response will
 * include as many bytes as possible.  A request with a zero byte max
 * effectively queries the status of the queue without removing any bytes.
 *
 * A binary representation of this request is three bytes in
 * length and consists of:
 *
 *   - a function code (1 byte),
 *   - a FIFO identifier (1 byte),
 *   - Maximum bytes to return
 *
 * @constructor
 * @extends {Request}
 * @param {integer} id Identifies the FIFO to be read
 * @param {integer} max Max number of bytes to be read (optional)
 *
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function ReadFifo8Request( id, max )
{
  Request.call(this, theFunctionCode);

  if('undefined' == typeof( max )) {
    max = maxLimit;
  }

  this.id = util.prepareNumericOption( id, 0, 0, 255, 'FIFO8 id');
  this.max = util.prepareNumericOption( max, 0, 0, maxLimit, 'Max bytes');

}

util.inherits(ReadFifo8Request, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *   - id: FIFO to read from
 *   - max: max number of bytes to read
 *
 * @param {object} options An options object.
 * @param {number} [options.id] Identifies the FIFO to be read
 * @param {number} [options.max] Max number of bytes to be read
 *
 * @returns {ReadFifo8Request} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadFifo8Request.fromOptions = function(options)
{
  options.max = options.max || maxLimit;

  return new ReadFifo8Request(options.id, options.max);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadFifo8Request} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadFifo8Request.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 3);
  util.assertFunctionCode(buffer[0], theFunctionCode);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  return new ReadFifo8Request(buffer[1], buffer[2]);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadFifo8Request.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();

  builder
    .pushByte(theFunctionCode)
    .pushByte(this.id)
    .pushByte(this.max);

  return builder.toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadFifo8Request.prototype.toString = function()
{
  return util.format(
    "0x41 (REQ) Read up to %d bytes from FIFO %d",
    this.max,
    this.id
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadFifo8Request.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadFifo8Response
  );
};

/**
 * @returns {number} FIFO id
 */
ReadFifo8Request.prototype.getId = function()
{
  return this.id;
};

/**
 * @returns {number} max bytes to read
 */
ReadFifo8Request.prototype.getMax = function()
{
  return this.max;
};
/*jshint unused:false*/


},{"./ReadFifo8Response":41,"./Request":54,"./util":73,"h5.buffers":83}],41:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadFifo8Response;

/**
 * The read FIFO8 response (code 0x41).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a FIFO status (1 byte),
 *   - a count of bytes which follow
 *   - values of the registers (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} status A status indicator
 * @param {Buffer} values data bytes
 * @throws {Error} If the length of the `values` buffer is not
 * between 2 and 250.
 */
function ReadFifo8Response(status, values)
{
  Response.call(this, 0x41);

  if (values.length < 0 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` buffer must be a number "
        + "between 0 and 250, got: %d",
      values.length
    ));

  }

  this.values = values;

  this.status = status;

}

util.inherits(ReadFifo8Response, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `status` (number, required) - FIFO status byte
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 0 and 250.
 *
 * @param {object} options An options object.
 * @param {number} options.status a status code
 * @param {Buffer} options.values
 * @returns {ReadFifo8Response} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadFifo8Response.fromOptions = function(options)
{
  return new ReadFifo8Response(options.status, options.values);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadFifo8Response} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the response message.
 */
ReadFifo8Response.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 3);
  util.assertFunctionCode(buffer[0], 0x41);

  var status = {
    more: ( buffer[1] & 0x01) > 0,
    overflow: ( buffer[1] & 0x02) > 0
  };
  var byteCount = buffer[2];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 3, byteCount + 3);

  return new ReadFifo8Response(status, values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadFifo8Response.prototype.toBuffer = function()
{
  var status = 0;
  if( this.status.more )
    status |= 1;

  if( this.status.overflow )
    status |= 2;

  return new buffers.BufferBuilder()
    .pushByte(0x41)
    .pushByte(status)
    .pushByte(this.values.length)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadFifo8Response.prototype.toString = function()
{
  var status = '';

  if( this.status.more )
    status = status + 'more ';

  if( this.status.overflow )
    status = status + 'overflow';

  return util.format(
    "0x41 (RES) Status: %s, %d bytes: ",
    status,
    this.values.length,
    this.values
  );
};

/**
 * @returns {Buffer} Values of the data values.
 */
ReadFifo8Response.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the data values.
 */
ReadFifo8Response.prototype.getCount = function()
{
  return this.values.length;
};

/**
 * @returns {number} Status byte for the buffer
 */
ReadFifo8Response.prototype.getStatus = function()
{
  return this.status;
};
}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],42:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var ReadFileRecordResponse = require('./ReadFileRecordResponse');

module.exports = ReadFileRecordRequest;

/**
 * The read file record request (code 0x14).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count (1 byte),
 *   - a list of sub-requests, where each sub-request consists of:
 *     - a reference type (1 byte),
 *     - a file number (2 bytes),
 *     - a record number (2 bytes),
 *     - a record length (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {Array.<ReadFileSubRequest>} subRequests An array of sub-requests.
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function ReadFileRecordRequest(subRequests)
{
  Request.call(this, 0x14);

  /**
   * An array of sub-requests.
   *
   * @private
   * @type {Array.<ReadFileSubRequest>}
   */
  this.subRequests = subRequests.map(function(subRequest)
  {
    subRequest.fileNumber = util.prepareNumericOption(
      subRequest.fileNumber, 1, 0x0001, 0xFFFF, 'File number'
    );
    subRequest.recordNumber = util.prepareNumericOption(
      subRequest.recordNumber, 0, 0x0000, 0x270F, 'Record number'
    );
    subRequest.recordLength = util.prepareNumericOption(
      subRequest.recordLength, 1, 1, 120, 'Record length'
    );

    return subRequest;
  });
}

util.inherits(ReadFileRecordRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `subRequests` (array, required) -
 *     An array of sub-requests. Sub-request is an object with the following
 *     properties:
 *
 *       - `fileNumber` (number, required) - a file to read.
 *         Must be a number between 0x0001 and 0xFFFF.
 *
 *       - `recordNumber` (number, optional) - a starting record number.
 *         If specified, must be a number between 0x0000 and 0x270F.
 *         Defaults to 0.
 *
 *       - `recordLength` (number, optional) - a number of records to read.
 *         If specified must be a number between 1 and 120.
 *         Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {Array.<ReadFileSubRequest>} options.subRequests
 * @returns {ReadFileRecordRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadFileRecordRequest.fromOptions = function(options)
{
  return new ReadFileRecordRequest(options.subRequests);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadFileRecordRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadFileRecordRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 9);
  util.assertFunctionCode(buffer[0], 0x14);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  var subRequests = [];

  while (reader.length > 0)
  {
    var referenceType = reader.shiftByte();

    if (referenceType !== 6)
    {
      throw new Error(util.format(
        "Invalid reference type. Expected 6, got: %d", referenceType
      ));
    }

    subRequests.push({
      fileNumber: reader.shiftUInt16(),
      recordNumber: reader.shiftUInt16(),
      recordLength: reader.shiftUInt16()
    });
  }

  return new ReadFileRecordRequest(subRequests);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadFileRecordRequest.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();
  var subRequestCount = this.subRequests.length;

  builder
    .pushByte(0x14)
    .pushByte(7 * subRequestCount);

  for (var i = 0; i < subRequestCount; ++i)
  {
    var subRequest = this.subRequests[i];

    builder
      .pushByte(6)
      .pushUInt16(subRequest.fileNumber)
      .pushUInt16(subRequest.recordNumber)
      .pushUInt16(subRequest.recordLength);
  }

  return builder.toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadFileRecordRequest.prototype.toString = function()
{
  return util.format(
    "0x14 (REQ) Read %d records from %d files",
    this.subRequests.reduce(function(p, c) { return p + c.recordLength; }, 0),
    this.subRequests.length
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadFileRecordRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadFileRecordResponse
  );
};

/**
 * @returns {Array.<ReadFileSubRequest>} An array of sub-requests.
 */
ReadFileRecordRequest.prototype.getSubRequests = function()
{
  return this.subRequests;
};

/*jshint unused:false*/

/**
 * @typedef {{fileNumber: number, recordNumber: number, recordLength: number}}
 */
var ReadFileSubRequest;

},{"./ReadFileRecordResponse":43,"./Request":54,"./util":73,"h5.buffers":83}],43:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadFileRecordResponse;

/**
 * The read input registers response (code 0x14).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a response data length (1 byte),
 *   - a list of sub-responses, where each sub-response consists of:
 *     - a file response length (1 byte),
 *     - a reference type (1 byte),
 *     - a record data (variable number of bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Array.<Buffer>} subResponses An array of sub-responses.
 */
function ReadFileRecordResponse(subResponses)
{
  Response.call(this, 0x14);

  /**
   * An array of sub-responses.
   *
   * @private
   * @type {Array.<Buffer>}
   */
  this.subResponses = subResponses.map(function(subResponse)
  {
    if (subResponse.length < 2
      || subResponse.length > 240
      || subResponse.length % 2 !== 0)
    {
      throw new Error(util.format(
        "Invalid length of the sub-response. "
          + "Expected an even number between 2 and 240 bytes, got: %d",
        subResponse.length
      ));
    }

    return subResponse;
  });
}

util.inherits(ReadFileRecordResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `subResponses` (array, required) -
 *     An array of record data Buffers.
 *
 * @param {object} options An options object.
 * @param {Array.<Buffer>} options.subResponses
 * @returns {ReadFileRecordResponse} A response created
 * from the specified `options`.
 */
ReadFileRecordResponse.fromOptions = function(options)
{
  return new ReadFileRecordResponse(options.subResponses);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadFileRecordResponse} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
ReadFileRecordResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 6);
  util.assertFunctionCode(buffer[0], 0x14);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  var subResponses = [];

  while (reader.length > 0)
  {
    var fileResponseLength = reader.shiftByte();
    var referenceType = reader.shiftByte();

    if (referenceType !== 6)
    {
      throw new Error(util.format(
        "Invalid reference type. Expected 6, got: %d", referenceType
      ));
    }

    subResponses.push(reader.shiftBuffer(fileResponseLength - 1));
  }

  return new ReadFileRecordResponse(subResponses);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadFileRecordResponse.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();

  builder.pushByte(0x14);

  var subResponseCount = this.subResponses.length;
  var subResponsesLength = this.getTotalRecordDataLength();

  builder.pushByte(2 * subResponseCount + subResponsesLength);

  for (var i = 0; i < subResponseCount; ++i)
  {
    var subResponse = this.subResponses[i];

    builder
      .pushByte(subResponse.length + 1)
      .pushByte(6)
      .pushBuffer(subResponse);
  }

  return builder.toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadFileRecordResponse.prototype.toString = function()
{
  return util.format(
    "0x14 (RES) %d records from %d files",
    this.getTotalRecordDataLength() / 2,
    this.subResponses.length
  );
};

/**
 * @returns {Buffer} An array of sub-responses.
 */
ReadFileRecordResponse.prototype.getSubResponses = function()
{
  return this.subResponses;
};

/**
 * @returns {number} A total record data byte length of the all sub-responses.
 */
ReadFileRecordResponse.prototype.getTotalRecordDataLength = function()
{
  return this.subResponses.reduce(function(p, c) { return p + c.length; }, 0);
};

},{"./Response":55,"./util":73,"h5.buffers":83}],44:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var ReadHoldingRegistersResponse = require('./ReadHoldingRegistersResponse');

module.exports = ReadHoldingRegistersRequest;

/**
 * The read holding registers request (code 0x03).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of registers (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. Must be between 0 and 0xFFFF.
 * @param {number} quantity A quantity of registers. Must be between 1 and 125.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 125.
 */
function ReadHoldingRegistersRequest(address, quantity)
{
  Request.call(this, 0x03);

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of registers. A number between 1 and 125.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 125);
}

util.inherits(ReadHoldingRegistersRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of registers. If specified, must be a number
 *     between 1 and 125. Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {ReadHoldingRegistersRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadHoldingRegistersRequest.fromOptions = function(options)
{
  return new ReadHoldingRegistersRequest(options.address, options.quantity);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadHoldingRegistersRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadHoldingRegistersRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x03);

  return new ReadHoldingRegistersRequest(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadHoldingRegistersRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x03;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadHoldingRegistersRequest.prototype.toString = function()
{
  return util.format(
    "0x03 (REQ) Read %d holding registers starting from address %d",
    this.quantity,
    this.address
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadHoldingRegistersRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer, ReadHoldingRegistersResponse
  );
};

/**
 * @returns {number} A starting address.
 */
ReadHoldingRegistersRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of registers.
 */
ReadHoldingRegistersRequest.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./ReadHoldingRegistersResponse":45,"./Request":54,"./util":73,"buffer":2}],45:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadHoldingRegistersResponse;

/**
 * The read holding registers response (code 0x03).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count `N` (1 byte),
 *   - values of the registers (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Buffer} values Values of the registers.
 * A buffer of even length between 2 and 250.
 * @throws {Error} If the length of the `values` buffer is not
 * between 2 and 250.
 */
function ReadHoldingRegistersResponse(values)
{
  Response.call(this, 0x03);

  if (values.length % 2 !== 0 || values.length < 2 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` buffer must be an even number "
        + "between 2 and 250, got: %d",
      values.length
    ));
  }

  /**
   * Values of the registers. A buffer of even length between 2 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(ReadHoldingRegistersResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of even length
 *     between 2 and 250.
 *
 * @param {object} options An options object.
 * @param {Buffer} options.values
 * @returns {ReadHoldingRegistersResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadHoldingRegistersResponse.fromOptions = function(options)
{
  return new ReadHoldingRegistersResponse(options.values);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadHoldingRegistersResponse} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read holding registers response.
 */
ReadHoldingRegistersResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 4);
  util.assertFunctionCode(buffer[0], 0x03);

  var byteCount = buffer[1];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 2, byteCount + 2);

  return new ReadHoldingRegistersResponse(values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadHoldingRegistersResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x03)
    .pushByte(this.values.length)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadHoldingRegistersResponse.prototype.toString = function()
{
  return util.format(
    "0x03 (RES) %d holding registers:",
    this.values.length / 2,
    this.values
  );
};

/**
 * @returns {Buffer} Values of the registers.
 */
ReadHoldingRegistersResponse.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the register values.
 */
ReadHoldingRegistersResponse.prototype.getCount = function()
{
  return this.values.length / 2;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],46:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var ReadInputRegistersResponse = require('./ReadInputRegistersResponse');

module.exports = ReadInputRegistersRequest;

/**
 * The read input registers request (code 0x04).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of registers (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address.
 * Must be between 0x0000 and 0xFFFF.
 * @param {number} quantity A quantity of input registers.
 * Must be between 1 and 125.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 125.
 */
function ReadInputRegistersRequest(address, quantity)
{
  Request.call(this, 0x04);

  /**
   * A starting address. A number between 0x0000 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of input registers. A number between 1 and 125.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 125);
}

util.inherits(ReadInputRegistersRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of inputs. If specified, must be a number between 1 and 125.
 *     Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {ReadInputRegistersRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadInputRegistersRequest.fromOptions = function(options)
{
  return new ReadInputRegistersRequest(options.address, options.quantity);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadInputRegistersRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadInputRegistersRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x04);

  return new ReadInputRegistersRequest(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadInputRegistersRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x04;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadInputRegistersRequest.prototype.toString = function()
{
  return util.format(
    "0x04 (REQ) Read %d input registers starting from address %d",
    this.quantity,
    this.address
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadInputRegistersRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadInputRegistersResponse
  );
};

/**
 * @returns {number} A starting address.
 */
ReadInputRegistersRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of input registers.
 */
ReadInputRegistersRequest.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./ReadInputRegistersResponse":47,"./Request":54,"./util":73,"buffer":2}],47:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadInputRegistersResponse;

/**
 * The read input registers response (code 0x04).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count (`N`; 1 byte),
 *   - values of the registers (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Buffer} values Values of the registers. A buffer of even length
 * between 2 and 250.
 * @throws {Error} If the `values` is not a Buffer of even length
 * between 2 and 250.
 */
function ReadInputRegistersResponse(values)
{
  Response.call(this, 0x04);

  if (values.length % 2 !== 0 || values.length < 2 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be an even number " +
        "between 2 and 250, got '%d'",
      values.length
    ));
  }

  /**
   * Values of the registers. A buffer of even length between 2 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(ReadInputRegistersResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of even length
 *     between 2 and 250.
 *
 * @param {object} options An options object.
 * @returns {ReadInputRegistersResponse} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadInputRegistersResponse.fromOptions = function(options)
{
  return new ReadInputRegistersResponse(options.values);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadInputRegistersResponse} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
ReadInputRegistersResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 4);
  util.assertFunctionCode(buffer[0], 0x04);

  var byteCount = buffer[1];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 2, byteCount + 2);

  return new ReadInputRegistersResponse(values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadInputRegistersResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x04)
    .pushByte(this.values.length)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadInputRegistersResponse.prototype.toString = function()
{
  return util.format(
    "0x04 (RES) %d input registers:",
    this.values.length / 2,
    this.values
  );
};

/**
 * @returns {Buffer} Values of the registers.
 */
ReadInputRegistersResponse.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the register values.
 */
ReadInputRegistersResponse.prototype.getCount = function()
{
  return this.values.length / 2;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],48:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var ReadMemoryResponse = require('./ReadMemoryResponse');

module.exports = ReadMemoryRequest;

/**
 * The read memory request (code 0x45).
 *
 * The response to this request returns a set of bytes
 * read from the slave device.
 *
 * A binary representation of this request is 6 bytes in
 * length and consists of:
 *
 *   - a function code (1 byte),
 *   - memory type (1 byte)
 *   - page number (1 byte)
 *   - start address (2 bytes)
 *   - count of bytes to read (1 byte),
 *
 * @constructor
 * @extends {Request}
 * @param {integer} [type] memory type
 * @param {integer} [page] memory page where start address is located
 * @param {integer} [address] starting address for read operation
 * @param {integer} [count] number of bytes to read
 *
 *
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function ReadMemoryRequest( type, page, address, count )
{
  Request.call(this, 0x45);

  this.type = util.prepareNumericOption( type, 0, 0, 255, 'Type');
  this.page = util.prepareNumericOption( page, 0, 0, 255, 'Page');
  this.address = util.prepareAddress( address );
  this.count = util.prepareNumericOption( count, 250, 1, 250, 'Count');

}

util.inherits(ReadMemoryRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are as follows:
 *
 * @param {object} options An options object.
 * @param {number} [options.type] memory type
 * @param {number} [options.page] memory page where start address is located
 * @param {number} [options.address] starting address for read operation
 * @param {number} [options.count] number of bytes to read
 *
 * @returns {ReadMemoryRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadMemoryRequest.fromOptions = function(options)
{
  return new ReadMemoryRequest(options.type,
    options.page, options.address, options.count);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadMemoryRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadMemoryRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 6);
  util.assertFunctionCode(buffer[0], 0x45);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  return new ReadMemoryRequest(
    buffer[1],
    buffer[2],
    buffer.readUInt16BE(3, true),
    buffer[5]
    );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadMemoryRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(6);

  buffer[0] = 0x45;
  buffer[1] = this.type;
  buffer[2] = this.page;
  buffer.writeUInt16BE(this.address, 3, true);
  buffer[5] = this.count;

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadMemoryRequest.prototype.toString = function()
{
  return util.format(
    "0x45 (REQ) Read Memory type %d, page %d, address %d, count %d",
    this.type, this.page, this.address, this.count
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadMemoryRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadMemoryResponse
  );
};

/**
 * @returns {number} memory type
 */
ReadMemoryRequest.prototype.getType = function()
{
  return this.type;
};

/**
 * @returns {number} memory page
 */
ReadMemoryRequest.prototype.getPage = function()
{
  return this.page;
};

/**
 * @returns {number} memory address
 */
ReadMemoryRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} memory count
 */
ReadMemoryRequest.prototype.getCount = function()
{
  return this.count;
};

/*jshint unused:false*/


}).call(this,require("buffer").Buffer)
},{"./ReadMemoryResponse":49,"./Request":54,"./util":73,"buffer":2,"h5.buffers":83}],49:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadMemoryResponse;

/**
 * The read memory response (code 0x45).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a count of bytes which follow
 *   - memory data (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Buffer} values bytes containing the object
 * @throws {Error} If the length of the `values` buffer is not
 * acceptable.
 */
function ReadMemoryResponse( values )
{
  Response.call(this, 0x45);

  if (values.length < 0 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` buffer must be a number "
        + "between 0 and 250, got: %d",
      values.length
    ));
  }

  this.values = values;
}

util.inherits(ReadMemoryResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 0 and 250.
 *
 * @param {object} options An options object.
 * @param {number} options.status a status code
 * @param {Buffer} options.values
 * @returns {ReadMemoryResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadMemoryResponse.fromOptions = function(options)
{
  return new ReadMemoryResponse(options.values);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadMemoryResponse} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the response message.
 */
ReadMemoryResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x45);

  var byteCount = buffer[1];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 2, byteCount + 2);

  return new ReadMemoryResponse(values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadMemoryResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x45)
    .pushByte(this.values.length)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadMemoryResponse.prototype.toString = function()
{
  return util.format(
    "0x45 (RES) %d bytes: ",
    this.values.length,
    this.values
  );
};

/**
 * @returns {Buffer} Values of the data values.
 */
ReadMemoryResponse.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the data values.
 */
ReadMemoryResponse.prototype.getCount = function()
{
  return this.values.length;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],50:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var ReadObjectResponse = require('./ReadObjectResponse');

// The code for this message
var theFunctionCode = 0x43;

module.exports = ReadObjectRequest;

/**
 * The read Object request (code 0x43).
 *
 * The response to this request returns a binary object
 * read from the slave device.
 *
 * A binary representation of this request is two bytes in
 * length and consists of:
 *
 *   - a function code (1 byte),
 *   - an object identifier (1 byte),
 *
 * @constructor
 * @extends {Request}
 * @param {integer} id Identifies the FIFO to be read
 *
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function ReadObjectRequest( id )
{
  Request.call(this, theFunctionCode);

  this.id = util.prepareNumericOption( id, 0, 0, 255, 'Object id');
}

util.inherits(ReadObjectRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *   - id: object to read from
 *
 * @param {object} options An options object.
 * @param {number} [options.id] Identifies the object to be read
 *
 * @returns {ReadObjectRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadObjectRequest.fromOptions = function(options)
{
  return new ReadObjectRequest(options.id);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReadObjectRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReadObjectRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], theFunctionCode);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  return new ReadObjectRequest(buffer[1]);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReadObjectRequest.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();

  builder
    .pushByte(theFunctionCode)
    .pushByte(this.id);

  return builder.toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReadObjectRequest.prototype.toString = function()
{
  return util.format(
    "0x43 (REQ) Read Object %d",
    this.id
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReadObjectRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReadObjectResponse
  );
};

/**
 * @returns {number} Object id
 */
ReadObjectRequest.prototype.getId = function()
{
  return this.id;
};


/*jshint unused:false*/


},{"./ReadObjectResponse":51,"./Request":54,"./util":73,"h5.buffers":83}],51:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReadObjectResponse;

/**
 * The read holding registers response (code 0x43).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a count of bytes which follow
 *   - object data (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Buffer} values bytes containing the object
 * @throws {Error} If the length of the `values` buffer is not
 * acceptable.
 */
function ReadObjectResponse( values )
{
  Response.call(this, 0x43);

  if (values.length < 0 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` buffer must be a number "
        + "between 0 and 250, got: %d",
      values.length
    ));
  }

  /**
   * Values of the registers. A buffer of even length between 2 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(ReadObjectResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 0 and 250.
 *
 * @param {object} options An options object.
 * @param {number} options.status a status code
 * @param {Buffer} options.values
 * @returns {ReadObjectResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReadObjectResponse.fromOptions = function(options)
{
  return new ReadObjectResponse(options.values);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReadObjectResponse} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the response message.
 */
ReadObjectResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x43);

  var byteCount = buffer[1];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 2, byteCount + 2);

  return new ReadObjectResponse(values);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReadObjectResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x43)
    .pushByte(this.values.length)
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReadObjectResponse.prototype.toString = function()
{
  return util.format(
    "0x43 (RES) %d bytes: ",
    this.values.length,
    this.values
  );
};

/**
 * @returns {Buffer} Values of the data values.
 */
ReadObjectResponse.prototype.getValues = function()
{
  return this.values;
};

/**
 * @returns {number} A number of the data values.
 */
ReadObjectResponse.prototype.getCount = function()
{
  return this.values.length;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],52:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var ReportSlaveIdResponse = require('./ReportSlaveIdResponse');

module.exports = ReportSlaveIdRequest;

/**
 * The Report Slave ID request (code 0x11).
 *
 * A binary representation of this request is 1 byte long and consists of:
 *
 *   - a function code (1 byte),
 *
 * @constructor
 * @extends {Request}
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function ReportSlaveIdRequest()
{
  Request.call(this, 0x11);

}

util.inherits(ReportSlaveIdRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *
 * @param {object} options An options object.
 * @returns {ReportSlaveIdRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReportSlaveIdRequest.fromOptions = function(options)
{
  return new ReportSlaveIdRequest(options);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {ReportSlaveIdRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
ReportSlaveIdRequest.fromBuffer = function(buffer)
{
  if( buffer.length !== 1)
  {
    throw new Error(util.format(
      "The specified buffer must be at 1 bytes long, was %d.", buffer.length
    ));
  }
  util.assertFunctionCode(buffer[0], 0x11);

  return new ReportSlaveIdRequest();
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
ReportSlaveIdRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer([0x11]);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
ReportSlaveIdRequest.prototype.toString = function()
{
  return util.format(
    '0x11 (REQ) Report Slave ID' );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
ReportSlaveIdRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    ReportSlaveIdResponse
  );
};


/*jshint unused:false*/


}).call(this,require("buffer").Buffer)
},{"./ReportSlaveIdResponse":53,"./Request":54,"./util":73,"buffer":2,"h5.buffers":83}],53:[function(require,module,exports){
(function (Buffer){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = ReportSlaveIdResponse;

/**
 * The Slave ID response (code 0x11).
 *
 * A binary representation of this response is fixed length and consists of:
 *
 *   - a function code (1 byte),
 *   - a byte count `N` (1 byte),
 *   - a product ID (1 byte).
 *   - A run indicator (1 byte)
 *   - Software version (3 bytes)
 *   - optional additional data values (n bytes)
 *
 * @constructor
 * @extends {Response}
 * @param {byte} product Product ID
 * @param {byte} run The device's run indicator
 * @param {string} Software version (x.y.z) where x,y,and z are 0-255 inclusive
 * @param {buffer} Additional data bytes
 * @throws {Error} If the parameters are not valid
 */
function ReportSlaveIdResponse(product, run, version, values )
{
  Response.call(this, 0x11);

  if( product < 0 || product > 255 )
  {
    throw new Error(util.format(
      "Invalid Product ID, got: %d",
      product
    ));
  }

  if( run < 0 || run > 255 )
  {
    throw new Error(util.format(
      "Invalid Run Indicator, got: %d",
      run
    ));
  }

  var token = version.split('.');

  if( token.length !== 3 )
  {
    throw new Error(util.format(
      "Invalid Version, got: %s",
      version
    ));
  }

  /**
   * Values of the registers. A buffer of even length between 2 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.product = product;
  this.run = run;
  this.version = [
    parseInt(token[0],10),
    parseInt(token[1],10),
    parseInt(token[2],10)
    ];

  this.values = values || new Buffer(0);

}

util.inherits(ReportSlaveIdResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `product` (byte, required)
 *   - `run` (byte, required)
 *   - `version` (string, required)
 *   - `values` (buffer, optional)
 *
 * @param {object} options An options object.
 * @param {integer} options.product
 * @param {run} options.run
 * @param {version} options.version
 * @param {values} options.values
 * @returns {ReportSlaveIdResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
ReportSlaveIdResponse.fromOptions = function(options)
{
  options.values = options.values || new Buffer(0);

  return new ReportSlaveIdResponse(
    options.product,
    options.run,
    options.version);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {ReportSlaveIdResponse} A response
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read holding registers response.
 */
ReportSlaveIdResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 7);
  util.assertFunctionCode(buffer[0], 0x11);

  //var byteCount = buffer[1];
  var version = util.format(
    "%d.%d.%d",
    buffer[4],
    buffer[5],
    buffer[6]
    );

  var numValues = buffer.length - 7;
  var values = new Buffer( numValues );
  if( numValues > 0 ) {
    buffer.copy( values, 0, 7);
  }
  return new ReportSlaveIdResponse(buffer[2], buffer[3], version, values );
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
ReportSlaveIdResponse.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x11)
    .pushByte(this.product)
    .pushByte(this.run)
    .pushByte(this.version[0])
    .pushByte(this.version[1])
    .pushByte(this.version[2])
    .pushBuffer(this.values)
    .toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReportSlaveIdResponse.prototype.toString = function()
{
  var serial = '';

  if( 4 === this.values.length ) {
    serial = this.values.readUInt32BE(0).toString(10);
  }

  return util.format(
    "0x11 (RES) Prod: %d, Run: %d, Ver: %s Serial: %s",
    this.product,
    this.run,
    this.getVersion(),
    serial
  );
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
ReportSlaveIdResponse.prototype.getVersion = function()
{
  return util.format(
    "%d.%d.%d",
    this.version[0],
    this.version[1],
    this.version[2]
    );
};

/**
 * Returns the values buffer
 *
 * @returns {buffer} data values
 */
ReportSlaveIdResponse.prototype.getValues = function()
{
  return this.values;
};
}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2,"h5.buffers":83}],54:[function(require,module,exports){
/*jshint unused:false*/

'use strict';

var inherits = require('util').inherits;
var ModbusFunction = require('../ModbusFunction');
var ExceptionResponse = require('./ExceptionResponse');

module.exports = Request;

/**
 * @constructor
 * @extends {ModbusFunction}
 * @param {number} code
 */
function Request(code)
{
  ModbusFunction.call(this, code);
}

inherits(Request, ModbusFunction);

/**
 * @param {object} options
 * @param {number} options.code
 * @returns {Request}
 */
Request.fromOptions = function(options)
{
  var functions = require('./index');

  if (!functions.hasOwnProperty(options.code))
  {
    throw new Error("Unknown request for function code: " + options.code);
  }

  return functions[options.code].fromOptions(options);
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 */
Request.prototype.createResponse = function(responseBuffer)
{
  throw new Error("Abstract method must be overridden by the child class!");
};

/**
 * @protected
 * @param {Buffer} responseBuffer
 * @param {function(new:functions.Response)} Response
 * @returns {Response}
 */
Request.prototype.createExceptionOrResponse = function(responseBuffer, Response)
{
  if (responseBuffer[0] > 0x80)
  {
    return ExceptionResponse.fromBuffer(responseBuffer);
  }

  return Response.fromBuffer(responseBuffer);
};

},{"../ModbusFunction":20,"./ExceptionResponse":33,"./index":72,"util":10}],55:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var ModbusFunction = require('../ModbusFunction');

module.exports = Response;

/**
 * @constructor
 * @extends {ModbusFunction}
 * @param {number} code
 */
function Response(code)
{
  ModbusFunction.call(this, code);
}

inherits(Response, ModbusFunction);

/**
 * @returns {boolean}
 */
Response.prototype.isException = function()
{
  return false;
};

},{"../ModbusFunction":20,"util":10}],56:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteFifo8Response =
  require('./WriteFifo8Response');

module.exports = WriteFifo8Request;

/**
 * The write 8-bit FIFO request (code 0x42).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a FIFO Id (1 byte),
 *   - a byte count (`N`; 1 byte),
 *   - values to be written (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} id the FIFO ID
 * @param {Buffer} values Values to be written to the FIFO
 * @throws {Error} If the `id` is not a number between 0 and 0xFF.
 * @throws {Error} If the `values` is not between 1 and 250 bytes
 */
function WriteFifo8Request(id, values)
{
  Request.call(this, 0x42);

  if( values.length < 1 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be  "
        + "between 1 and 250, got: %d",
      values.length
    ));
  }

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.id = util.prepareNumericOption(id, 0, 0, 255, 'id');

  /**
   * Values of the registers. A buffer of length between 1 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(WriteFifo8Request, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `id` (number, optional) -
 *     The object ID. If specified, must be a number between 0 and 0xFF.
 *     Defaults to 0.
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 1 and 250.
 *
 * @param {object} options An options object.
 * @param {number} [options.id]
 * @param {Buffer} options.values
 * @returns {WriteFifo8Request} A request
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteFifo8Request.fromOptions = function(options)
{
  return new WriteFifo8Request(options.id, options.values);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteFifo8Request} A request
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteFifo8Request.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 4);
  util.assertFunctionCode(buffer[0], 0x42);

  var id = buffer[1];
  var byteCount = buffer[2];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 3, 3 + byteCount);

  return new WriteFifo8Request(id, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteFifo8Request.prototype.toBuffer = function()
{
  var buffer = new Buffer(3 + this.values.length);

  buffer[0] = 0x42;
  buffer[1] = this.id;
  buffer[2] = this.values.length;
  this.values.copy(buffer, 3);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteFifo8Request.prototype.toString = function()
{
  return util.format(
    "0x42 (REQ) Write %d bytes to FIFO %d :",
    this.values.length,
    this.id,
    this.values
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteFifo8Request.prototype.createResponse =
  function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteFifo8Response
  );
};

/**
 * @returns {number} The FIFO ID.
 */
WriteFifo8Request.prototype.getId = function()
{
  return this.id;
};

/**
 * @returns {Buffer} Values of the registers
 */
WriteFifo8Request.prototype.getValues = function()
{
  return this.values;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteFifo8Response":57,"./util":73,"buffer":2}],57:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteFifo8Response;

/**
 * The write 8-bit FIFO response (code 0x42).
 *
 * A binary representation of this response is 2 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a quantity of bytes (1 byte),
 *
 * @constructor
 * @extends {Response}
 * @param {number} quantity A quantity of bytes written.
 * @throws {Error} If the `quantity` is not a number between 0 and 250.
 */
function WriteFifo8Response(quantity)
{
  Response.call(this, 0x42);

  /**
   * A quantity of bytes written
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareNumericOption(quantity, 0, 0, 250, 'Quantity');
}

util.inherits(WriteFifo8Response, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `quantity` (number) -
 *     A quantity of bytes written.
 *
 * @param {object} options An options object.
 * @param {number} [options.quantity]
 * @returns {WriteFifo8Response} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteFifo8Response.fromOptions = function(options)
{
  return new WriteFifo8Response(options.quantity);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {WriteFifo8Response} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
WriteFifo8Response.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x42);

  return new WriteFifo8Response( buffer[1] );
};

/**
 * Returns a binary representation of the read input registers response.
 *
 * @returns {Buffer} A binary representation of the response.
 */
WriteFifo8Response.prototype.toBuffer = function()
{
  var buffer = new Buffer(2);

  buffer[0] = 0x42;
  buffer[1] = this.quantity;

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteFifo8Response.prototype.toString = function()
{
  return util.format(
    "0x42 (RES) Wrote %d bytes",
    this.quantity
  );
};

/**
 * @returns {number} A quantity of bytes written.
 */
WriteFifo8Response.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],58:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var WriteFileRecordResponse = require('./WriteFileRecordResponse');

module.exports = WriteFileRecordRequest;

/**
 * The write file record request (code 0x15).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a request data length (1 byte),
 *   - a list of sub-requests, where each sub-request consists of:
 *     - a reference type (1 byte),
 *     - a file number (2 bytes),
 *     - a record number (2 bytes),
 *     - a record length (`N`; 2 bytes),
 *     - a record data (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {Array.<WriteFileSubRequest>} subRequests An array of sub-requests.
 * @throws {Error} If any of the specified sub-requests are invalid.
 */
function WriteFileRecordRequest(subRequests)
{
  Request.call(this, 0x15);

  /**
   * An array of sub-requests.
   *
   * @private
   * @type {Array.<WriteFileSubRequest>}
   */
  this.subRequests = subRequests.map(function(subRequest)
  {
    subRequest.fileNumber = util.prepareNumericOption(
      subRequest.fileNumber, 1, 0x0001, 0xFFFF, 'File number'
    );
    subRequest.recordNumber = util.prepareNumericOption(
      subRequest.recordNumber, 0, 0x0000, 0x270F, 'Record number'
    );

    var recordDataLength = subRequest.recordData.length;

    if (recordDataLength === 0
      || recordDataLength > 240
      || recordDataLength % 2 !== 0)
    {
      throw new Error(util.format(
        "Invalid record data length. "
          + "Expected an even number of bytes between 2 and 240, got: %d",
        recordDataLength
      ));
    }

    return subRequest;
  });
}

util.inherits(WriteFileRecordRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `subRequests` (array, required) -
 *     An array of sub-requests. Sub-request is an object with the following
 *     properties:
 *
 *       - `fileNumber` (number, required) - a file to read.
 *         Must be a number between 0x0001 and 0xFFFF.
 *
 *       - `recordNumber` (number, optional) - a starting record number.
 *         If specified, must be a number between 0x0000 and 0x270F.
 *         Defaults to 0.
 *
 *       - `recordData` (Buffer, required) - a record data to write.
 *         Must be of an even length between 2 and 240 bytes.
 *
 * @param {object} options An options object.
 * @param {Array.<WriteFileSubRequest>} options.subRequests
 * @returns {WriteFileRecordRequest} A request created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteFileRecordRequest.fromOptions = function(options)
{
  return new WriteFileRecordRequest(options.subRequests);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteFileRecordRequest} A request created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteFileRecordRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 11);
  util.assertFunctionCode(buffer[0], 0x15);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  var subRequests = [];

  while (reader.length > 0)
  {
    var referenceType = reader.shiftByte();

    if (referenceType !== 6)
    {
      throw new Error(util.format(
        "Invalid reference type. Expected 6, got: %d", referenceType
      ));
    }

    subRequests.push({
      fileNumber: reader.shiftUInt16(),
      recordNumber: reader.shiftUInt16(),
      recordData: reader.shiftBuffer(reader.shiftUInt16() * 2)
    });
  }

  return new WriteFileRecordRequest(subRequests);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteFileRecordRequest.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();
  var subRequestCount = this.subRequests.length;

  builder
    .pushByte(0x15)
    .pushByte(7 * subRequestCount + this.getTotalRecordDataLength());

  for (var i = 0; i < subRequestCount; ++i)
  {
    var subRequest = this.subRequests[i];

    builder
      .pushByte(6)
      .pushUInt16(subRequest.fileNumber)
      .pushUInt16(subRequest.recordNumber)
      .pushUInt16(subRequest.recordData.length / 2)
      .pushBuffer(subRequest.recordData);
  }

  return builder.toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteFileRecordRequest.prototype.toString = function()
{
  return util.format(
    "0x15 (REQ) Write %d records to %d files",
    this.getTotalRecordDataLength() / 2,
    this.subRequests.length
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteFileRecordRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteFileRecordResponse
  );
};

/**
 * @returns {Array.<WriteFileSubRequest>} An array of sub-requests.
 */
WriteFileRecordRequest.prototype.getSubRequests = function()
{
  return this.subRequests;
};

/**
 * @returns {number} A total record data byte length of the all sub-requests.
 */
WriteFileRecordRequest.prototype.getTotalRecordDataLength = function()
{
  return this.subRequests.reduce(
    function(p, c) { return p + c.recordData.length; },
    0
  );
};

/*jshint unused:false*/

/**
 * @typedef {{fileNumber: number, recordNumber: number, recordData: Buffer}}
 */
var WriteFileSubRequest;

},{"./Request":54,"./WriteFileRecordResponse":59,"./util":73,"h5.buffers":83}],59:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Response = require('./Response');

module.exports = WriteFileRecordResponse;

/**
 * The write file record response (code 0x15).
 *
 * A binary representation of this response varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a response data length (1 byte),
 *   - a list of sub-responses, where each sub-response consists of:
 *     - a reference type (1 byte),
 *     - a file number (2 bytes),
 *     - a record number (2 bytes),
 *     - a record length (`N`; 2 bytes),
 *     - a record data (`N` bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {Array.<WriteFileSubResponse>} subResponses An array of sub-responses.
 * @throws {Error} If any of the specified sub-responses are invalid.
 */
function WriteFileRecordResponse(subResponses)
{
  Response.call(this, 0x15);

  /**
   * An array of sub-responses.
   *
   * @private
   * @type {Array.<WriteFileSubResponse>}
   */
  this.subResponses = subResponses.map(function(subResponse)
  {
    subResponse.fileNumber = util.prepareNumericOption(
      subResponse.fileNumber, 1, 0x0001, 0xFFFF, 'File number'
    );
    subResponse.recordNumber = util.prepareNumericOption(
      subResponse.recordNumber, 0, 0x0000, 0x270F, 'Record number'
    );

    var recordDataLength = subResponse.recordData.length;

    if (recordDataLength === 0
      || recordDataLength > 240
      || recordDataLength % 2 !== 0)
    {
      throw new Error(util.format(
        "Invalid record data length. "
          + "Expected an even number of bytes between 2 and 240, got: %d",
        recordDataLength
      ));
    }

    return subResponse;
  });
}

util.inherits(WriteFileRecordResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `subResponses` (array, required) -
 *     An array of sub-responses. Sub-response is an object with the following
 *     properties:
 *
 *       - `fileNumber` (number, required) - a file to read.
 *         Must be a number between 0x0001 and 0xFFFF.
 *
 *       - `recordNumber` (number, optional) - a starting record number.
 *         If specified, must be a number between 0x0000 and 0x270F.
 *         Defaults to 0.
 *
 *       - `recordData` (Buffer, required) - a written record data.
 *         Must be of an even length between 2 and 240 bytes.
 *
 * @param {object} options An options object.
 * @param {Array.<WriteFileSubResponse>} options.subResponses
 * @returns {WriteFileRecordResponse} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteFileRecordResponse.fromOptions = function(options)
{
  return new WriteFileRecordResponse(options.subResponses);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteFileRecordResponse} A response created from its binary
 * representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
WriteFileRecordResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 11);
  util.assertFunctionCode(buffer[0], 0x15);

  var reader = new buffers.BufferReader(buffer);

  reader.skip(2);

  var subResponses = [];

  while (reader.length > 0)
  {
    var referenceType = reader.shiftByte();

    if (referenceType !== 6)
    {
      throw new Error(util.format(
        "Invalid reference type. Expected 6, got: %d", referenceType
      ));
    }

    subResponses.push({
      fileNumber: reader.shiftUInt16(),
      recordNumber: reader.shiftUInt16(),
      recordData: reader.shiftBuffer(reader.shiftUInt16() * 2)
    });
  }

  return new WriteFileRecordResponse(subResponses);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
WriteFileRecordResponse.prototype.toBuffer = function()
{
  var builder = new buffers.BufferBuilder();
  var subResponseCount = this.subResponses.length;

  builder
    .pushByte(0x15)
    .pushByte(7 * subResponseCount + this.getTotalRecordDataLength());

  for (var i = 0; i < subResponseCount; ++i)
  {
    var subResponse = this.subResponses[i];

    builder
      .pushByte(6)
      .pushUInt16(subResponse.fileNumber)
      .pushUInt16(subResponse.recordNumber)
      .pushUInt16(subResponse.recordData.length / 2)
      .pushBuffer(subResponse.recordData);
  }

  return builder.toBuffer();
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteFileRecordResponse.prototype.toString = function()
{
  return util.format(
    "0x15 (RES) %d records were written to %d files",
    this.getTotalRecordDataLength() / 2,
    this.subResponses.length
  );
};

/**
 * @returns {Array.<WriteFileSubResponse>} An array of sub-responses.
 */
WriteFileRecordResponse.prototype.getSubResponses = function()
{
  return this.subResponses;
};

/**
 * @returns {number} A total record data byte length of the all sub-responses.
 */
WriteFileRecordResponse.prototype.getTotalRecordDataLength = function()
{
  return this.subResponses.reduce(
    function(p, c) { return p + c.recordData.length; },
    0
  );
};

/*jshint unused:false*/

/**
 * @typedef {{fileNumber: number, recordNumber: number, recordData: Buffer}}
 */
var WriteFileSubResponse;

},{"./Response":55,"./util":73,"h5.buffers":83}],60:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteMemoryResponse =
  require('./WriteMemoryResponse');

module.exports = WriteMemoryRequest;

/**
 * The write memory request (code 0x46).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a memory type (1 byte),
 *   - a page number (1 byte),
 *   - a starting address (2 bytes, big endian),
 *   - a byte count (`N`; 1 byte),
 *   - values to be written (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} id the object ID
 * @param {Buffer} values the object data
 * @throws {Error} If the `id` is not a number between 0 and 0xFF.
 * @throws {Error} If the `values` is not between 1 and 250 bytes
 */
function WriteMemoryRequest(type, page, address, values)
{
  Request.call(this, 0x46);

  if( values.length < 1 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be  "
        + "between 1 and 250, got: %d",
      values.length
    ));
  }

  /**
   * Memory type A number between 0 and 0xFF.
   *
   * @private
   * @type {number}
   */
  this.type = util.prepareNumericOption(type, 0, 0, 255, 'type');

  /**
   * Memory page A number between 0 and 0xFF.
   *
   * @private
   * @type {number}
   */
  this.page = util.prepareNumericOption(page, 0, 0, 255, 'page');

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * Values of the registers. A buffer of length between 1 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(WriteMemoryRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `type` (number, optional) -
 *     The memory type. If specified, must be a number between 0 and 0xFF.
 *     Defaults to 0.
 *
 *   - `page` (number, optional) -
 *     The memory page. If specified, must be a number between 0 and 0xFF.
 *     Defaults to 0.

 *   - `address` (number, optional) -
 *     The starting address. If specified, must be a number
 *     between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 1 and 250.
 *
 * @param {object} options An options object.
 * @param {number} [options.type]
 * @param {number} [options.page]
 * @param {number} [options.address]
 * @param {Buffer} options.values
 * @returns {WriteMemoryRequest} A request
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMemoryRequest.fromOptions = function(options)
{
  return new WriteMemoryRequest(options.type, options.page,
    options.address, options.values);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteMemoryRequest} A request
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteMemoryRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 7);
  util.assertFunctionCode(buffer[0], 0x46);

  var type = buffer[1];
  var page = buffer[2];
  var address = buffer.readUInt16BE(3, true);

  var byteCount = buffer[5];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 6, 6 + byteCount);

  return new WriteMemoryRequest(type, page, address, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteMemoryRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(6 + this.values.length);

  buffer[0] = 0x46;
  buffer[1] = this.type;
  buffer[2] = this.page;
  buffer.writeUInt16BE(this.address, 3, true);
  buffer[5] = this.values.length;

  this.values.copy(buffer, 6);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteMemoryRequest.prototype.toString = function()
{
  return util.format(
    "0x46 (REQ) Write %d bytes to Memory type %d at address %d:%d:",
    this.values.length,
    this.type,
    this.page,
    this.address,
    this.values
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteMemoryRequest.prototype.createResponse =
  function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteMemoryResponse
  );
};

/**
 * @returns {number} The memory type.
 */
WriteMemoryRequest.prototype.getType = function()
{
  return this.type;
};

/**
 * @returns {number} The memory page.
 */
WriteMemoryRequest.prototype.getPage = function()
{
  return this.page;
};

/**
 * @returns {number} The memory address.
 */
WriteMemoryRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} The byte count.
 */
WriteMemoryRequest.prototype.getCount = function()
{
  return this.values.length;
};

/**
 * @returns {Buffer} Values of the registers
 */
WriteMemoryRequest.prototype.getValues = function()
{
  return this.values;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteMemoryResponse":61,"./util":73,"buffer":2}],61:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteMemoryResponse;

/**
 * The write memory response (code 0x46).
 *
 * A binary representation of this response is 2 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a response status (1 byte),
 *
 * @constructor
 * @extends {Response}
 * @param {number} status A success indicator (0=success)
 * @throws {Error} If the `quantity` is not a number between 0 and 250.
 */
function WriteMemoryResponse(quantity)
{
  Response.call(this, 0x46);

  /**
   * Response status
   *
   * @private
   * @type {number}
   */
  this.status = util.prepareNumericOption(quantity, 0, 0, 250, 'Code');
}

util.inherits(WriteMemoryResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `status` (number) -
 *     result status
 *
 * @param {object} options An options object.
 * @param {number} [options.status]
 * @returns {WriteMemoryResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMemoryResponse.fromOptions = function(options)
{
  return new WriteMemoryResponse(options.status);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {WriteMemoryResponse} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
WriteMemoryResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x46);

  return new WriteMemoryResponse( buffer[1] );
};

/**
 * Returns a binary representation of the read input registers response.
 *
 * @returns {Buffer} A binary representation of the response.
 */
WriteMemoryResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(2);

  buffer[0] = 0x46;
  buffer[1] = this.status;

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteMemoryResponse.prototype.toString = function()
{
  return util.format(
    "0x46 (RES) Result status %d",
    this.status
  );
};

/**
 * @returns {number} A quantity of bytes written.
 */
WriteMemoryResponse.prototype.getStatus = function()
{
  return this.status;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],62:[function(require,module,exports){
'use strict';

var buffers = require('h5.buffers');
var util = require('./util');
var Request = require('./Request');
var WriteMultipleCoilsResponse = require('./WriteMultipleCoilsResponse');

module.exports = WriteMultipleCoilsRequest;

/**
 * The write multiple coils request (code 0x0F).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of outputs (2 bytes),
 *   - a byte count (`N`; 1 byte),
 *   - states of the coils (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. A number between 0 and 0xFFFF.
 * @param {Array.<boolean>} states States of the coils. An array of 1 and 1968
 * truthy or falsy values.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `states` is not an array of length between 1 and 1968.
 */
function WriteMultipleCoilsRequest(address, states)
{
  Request.call(this, 0x0F);

  if (states.length < 1 || states.length > 1968)
  {
    throw new Error(util.format(
      "The length of the statuses array must be between 1 and 1968, got: %d",
      states.length
    ));
  }

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * States of the coils. An array of 1 and 1968 truthy or falsy values.
   *
   * @private
   * @type {Array.<boolean>}
   */
  this.states = states;
}

util.inherits(WriteMultipleCoilsRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, required) -
 *     A starting address. Must be a number between 0 and 0xFFFF.
 *
 *   - `states` (array, required) -
 *     States of the coils. Must be an array of 1 to 1968
 *     truthy or falsy values.
 *
 * @param {object} options An options object.
 * @param {number} options.address
 * @param {Array.<boolean>} options.states
 * @returns {WriteMultipleCoilsRequest} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMultipleCoilsRequest.fromOptions = function(options)
{
  return new WriteMultipleCoilsRequest(options.address, options.states);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteMultipleCoilsRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteMultipleCoilsRequest.fromBuffer = function(buffer)
{
  var reader = new buffers.BufferReader(buffer);

  util.assertFunctionCode(reader.shiftByte(), 0x0F);

  var address = reader.shiftUInt16();
  var quantity = reader.shiftUInt16();

  reader.skip(1);

  var states = reader.shiftBits(quantity);

  return new WriteMultipleCoilsRequest(address, states);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteMultipleCoilsRequest.prototype.toBuffer = function()
{
  return new buffers.BufferBuilder()
    .pushByte(0x0F)
    .pushUInt16(this.address)
    .pushUInt16(this.states.length)
    .pushByte(Math.ceil(this.states.length / 8))
    .pushBits(this.states)
    .toBuffer();
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteMultipleCoilsRequest.prototype.toString = function()
{
  return util.format(
    "0x0F (REQ) Set %d coils starting from address %d to:",
    this.states.length,
    this.address,
    this.states.map(Number)
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteMultipleCoilsRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteMultipleCoilsResponse
  );
};

/**
 * @returns {number} A starting address.
 */
WriteMultipleCoilsRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {Array.<boolean>} States of the coils.
 */
WriteMultipleCoilsRequest.prototype.getStates = function()
{
  return this.states;
};

},{"./Request":54,"./WriteMultipleCoilsResponse":63,"./util":73,"h5.buffers":83}],63:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteMultipleCoilsResponse;

/**
 * The write multiple coils response (code 0x0F).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of outputs set (2 bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} address A starting address.
 * Must be between 0x0000 and 0xFFFF.
 * @param {number} quantity A quantity of outputs set.
 * Must be between 1 and 1968.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 1968.
 */
function WriteMultipleCoilsResponse(address, quantity)
{
  Response.call(this, 0x0F);

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of outputs written. A number between 1 and 1968.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 1968);
}

util.inherits(WriteMultipleCoilsResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of coils set.
 *     If specified, must be a number between 1 and 1968.
 *     Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {WriteMultipleCoilsResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMultipleCoilsResponse.fromOptions = function(options)
{
  return new WriteMultipleCoilsResponse(options.address, options.quantity);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteMultipleCoilsResponse} A response created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
WriteMultipleCoilsResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x0F);

  var address = buffer.readUInt16BE(1, true);
  var quantity = buffer.readUInt16BE(3, true);

  return new WriteMultipleCoilsResponse(address, quantity);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
WriteMultipleCoilsResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x0F;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteMultipleCoilsResponse.prototype.toString = function()
{
  return util.format(
    "0x0F (RES) %d coils starting from address %d were set",
    this.quantity,
    this.address
  );
};

/**
 * @returns {number} A starting address.
 */
WriteMultipleCoilsResponse.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of outputs written.
 */
WriteMultipleCoilsResponse.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],64:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteMultipleRegistersResponse =
  require('./WriteMultipleRegistersResponse');

module.exports = WriteMultipleRegistersRequest;

/**
 * The write multiple registers request (code 0x10).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of registers (2 bytes),
 *   - a byte count (`N`; 1 byte),
 *   - values of the registers (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A starting address. A number between 0 and 0xFFFF.
 * @param {Buffer} values Values of the registers.
 * A buffer of even length between 2 and 246.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `values` is not a Buffer of even length
 * between 2 and 246.
 */
function WriteMultipleRegistersRequest(address, values)
{
  Request.call(this, 0x10);

  if (values.length % 2 !== 0 || values.length < 2 || values.length > 246)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be an even number "
        + "between 2 and 246, got: %d",
      values.length
    ));
  }

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * Values of the registers. A buffer of even length between 2 and 246.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(WriteMultipleRegistersRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of even length
 *     between 2 and 246.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {Buffer} options.values
 * @returns {WriteMultipleRegistersRequest} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMultipleRegistersRequest.fromOptions = function(options)
{
  return new WriteMultipleRegistersRequest(options.address, options.values);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteMultipleRegistersRequest} A request
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteMultipleRegistersRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 8);
  util.assertFunctionCode(buffer[0], 0x10);

  var address = buffer.readUInt16BE(1, true);
  var byteCount = buffer[5];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 6, 6 + byteCount);

  return new WriteMultipleRegistersRequest(address, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteMultipleRegistersRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(6 + this.values.length);

  buffer[0] = 0x10;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.values.length / 2, 3, true);
  buffer[5] = this.values.length;
  this.values.copy(buffer, 6);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteMultipleRegistersRequest.prototype.toString = function()
{
  return util.format(
    "0x10 (REQ) Set %d registers starting from address %d to:",
    this.values.length / 2,
    this.address,
    this.values
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteMultipleRegistersRequest.prototype.createResponse =
  function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteMultipleRegistersResponse
  );
};

/**
 * @returns {number} A starting address.
 */
WriteMultipleRegistersRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {Buffer} Values of the registers
 */
WriteMultipleRegistersRequest.prototype.getValues = function()
{
  return this.values;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteMultipleRegistersResponse":65,"./util":73,"buffer":2}],65:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteMultipleRegistersResponse;

/**
 * The write multiple registers response (code 0x10).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a starting address (2 bytes),
 *   - a quantity of registers written (2 bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} address A starting address. A number between 0 and 0xFFFF.
 * @param {number} quantity A quantity of registers written.
 * A number between 1 and 123.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `quantity` is not a number between 1 and 123.
 */
function WriteMultipleRegistersResponse(address, quantity)
{
  Response.call(this, 0x10);

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A quantity of registers written. A number between 1 and 123.
   *
   * @private
   * @type {number}
   */
  this.quantity = util.prepareQuantity(quantity, 123);
}

util.inherits(WriteMultipleRegistersResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `address` (number, optional) -
 *     A starting address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `quantity` (number, optional) -
 *     A quantity of registers written. If specified, must be a number
 *     between 1 and 123. Defaults to 1.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.quantity]
 * @returns {WriteMultipleRegistersResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteMultipleRegistersResponse.fromOptions = function(options)
{
  return new WriteMultipleRegistersResponse(options.address, options.quantity);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {WriteMultipleRegistersResponse} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
WriteMultipleRegistersResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x10);

  return new WriteMultipleRegistersResponse(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of the read input registers response.
 *
 * @returns {Buffer} A binary representation of the response.
 */
WriteMultipleRegistersResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x10;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.quantity, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteMultipleRegistersResponse.prototype.toString = function()
{
  return util.format(
    "0x10 (RES) %d registers starting from address %d were written",
    this.quantity,
    this.address
  );
};

/**
 * @returns {number} A starting address.
 */
WriteMultipleRegistersResponse.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A quantity of registers written.
 */
WriteMultipleRegistersResponse.prototype.getQuantity = function()
{
  return this.quantity;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],66:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteObjectResponse =
  require('./WriteObjectResponse');

module.exports = WriteObjectRequest;

/**
 * The write object request (code 0x44).
 *
 * A binary representation of this request varies in length and consists of:
 *
 *   - a function code (1 byte),
 *   - an object id (1 byte),
 *   - a byte count (`N`; 1 byte),
 *   - values of the registers (`N` bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} id the object ID
 * @param {Buffer} values the object data
 * @throws {Error} If the `id` is not a number between 0 and 0xFF.
 * @throws {Error} If the `values` is not between 1 and 250 bytes
 */
function WriteObjectRequest(id, values)
{
  Request.call(this, 0x44);

  if( values.length < 1 || values.length > 250)
  {
    throw new Error(util.format(
      "The length of the `values` Buffer must be  "
        + "between 1 and 250, got: %d",
      values.length
    ));
  }

  /**
   * A starting address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.id = util.prepareNumericOption(id, 0, 0, 255, 'id');

  /**
   * Values of the registers. A buffer of length between 1 and 250.
   *
   * @private
   * @type {Buffer}
   */
  this.values = values;
}

util.inherits(WriteObjectRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `id` (number, optional) -
 *     The object ID. If specified, must be a number between 0 and 0xFF.
 *     Defaults to 0.
 *
 *   - `values` (Buffer, required) -
 *     Values of the registers. Must be a buffer of length
 *     between 1 and 250.
 *
 * @param {object} options An options object.
 * @param {number} [options.id]
 * @param {Buffer} options.values
 * @returns {WriteObjectRequest} A request
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteObjectRequest.fromOptions = function(options)
{
  return new WriteObjectRequest(options.id, options.values);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteObjectRequest} A request
 * created from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteObjectRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 4);
  util.assertFunctionCode(buffer[0], 0x44);

  var id = buffer[1];
  var byteCount = buffer[2];
  var values = new Buffer(byteCount);

  buffer.copy(values, 0, 3, 3 + byteCount);

  return new WriteObjectRequest(id, values);
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteObjectRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(3 + this.values.length);

  buffer[0] = 0x44;
  buffer[1] = this.id;
  buffer[2] = this.values.length;
  this.values.copy(buffer, 3);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteObjectRequest.prototype.toString = function()
{
  return util.format(
    "0x44 (REQ) Write %d bytes to Object %d :",
    this.values.length,
    this.id,
    this.values
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteObjectRequest.prototype.createResponse =
  function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteObjectResponse
  );
};

/**
 * @returns {number} The Object ID.
 */
WriteObjectRequest.prototype.getId = function()
{
  return this.id;
};

/**
 * @returns {Buffer} object data
 */
WriteObjectRequest.prototype.getValues = function()
{
  return this.values;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteObjectResponse":67,"./util":73,"buffer":2}],67:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteObjectResponse;

/**
 * The write Object response (code 0x44).
 *
 * A binary representation of this response is 2 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a response status (1 byte),
 *
 * @constructor
 * @extends {Response}
 * @param {number} status A success indicator (0=success)
 * @throws {Error} If the `quantity` is not a number between 0 and 250.
 */
function WriteObjectResponse(quantity)
{
  Response.call(this, 0x44);

  /**
   * the response status
   *
   * @private
   * @type {number}
   */
  this.status = util.prepareNumericOption(quantity, 0, 0, 250, 'Code');
}

util.inherits(WriteObjectResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this response are:
 *
 *   - `status` (number) -
 *     result status
 *
 * @param {object} options An options object.
 * @param {number} [options.status]
 * @returns {WriteObjectResponse} A response
 * created from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteObjectResponse.fromOptions = function(options)
{
  return new WriteObjectResponse(options.status);
};

/**
 * Creates a response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of the response.
 * @returns {WriteObjectResponse} Read input
 * registers response.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of the read input registers response.
 */
WriteObjectResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 2);
  util.assertFunctionCode(buffer[0], 0x44);

  return new WriteObjectResponse( buffer[1] );
};

/**
 * Returns a binary representation of the read input registers response.
 *
 * @returns {Buffer} A binary representation of the response.
 */
WriteObjectResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(2);

  buffer[0] = 0x44;
  buffer[1] = this.status;

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteObjectResponse.prototype.toString = function()
{
  return util.format(
    "0x44 (RES) Result status %d",
    this.status
  );
};

/**
 * @returns {number} A quantity of bytes written.
 */
WriteObjectResponse.prototype.getStatus = function()
{
  return this.status;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],68:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteSingleCoilResponse = require('./WriteSingleCoilResponse');

module.exports = WriteSingleCoilRequest;

/**
 * The write single coil request (code 0x05).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an output address (2 bytes),
 *   - an output value (2 bytes).
 *
 * An output value of 0xFF00 requests the output to be ON.
 * A value of 0x0000 requests it to be OFF.
 *
 * @constructor
 * @extends {Request}
 * @param {number} address An output address. A number between 0 and 0xFFFF.
 * @param {boolean} state A state of the coil. `TRUE` - coil is ON;
 * `FALSE` - coil is OFF.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 */
function WriteSingleCoilRequest(address, state)
{
  Request.call(this, 0x05);

  /**
   * An output address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A state of the coil. `TRUE` - coil is ON; `FALSE` - coil is OFF.
   *
   * @private
   * @type {boolean}
   */
  this.state = !!state;
}

util.inherits(WriteSingleCoilRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     An output address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `state` (boolean, optional) -
 *     A state of the coil. `TRUE` - coil is ON; `FALSE` - coil is OFF.
 *     Defaults to `FALSE`.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {boolean} [options.state]
 * @returns {WriteSingleCoilRequest} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteSingleCoilRequest.fromOptions = function(options)
{
  return new WriteSingleCoilRequest(options.address, options.state);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteSingleCoilRequest} A request created from
 * its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteSingleCoilRequest.fromBuffer = function(buffer)
{
  util.assertFunctionCode(buffer[0], 0x05);

  return new WriteSingleCoilRequest(
    buffer.readUInt16BE(1),
    buffer.readUInt16BE(3) === 0xFF00
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteSingleCoilRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x05;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.state ? 0xFF00 : 0x0000, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteSingleCoilRequest.prototype.toString = function()
{
  return util.format(
    "0x05 (REQ) Set the coil at address %d to be %s",
    this.address,
    this.state ? 'ON' : 'OFF'
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteSingleCoilRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteSingleCoilResponse
  );
};

/**
 * @returns {number} An output address.
 */
WriteSingleCoilRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {boolean} A state of the coil.
 */
WriteSingleCoilRequest.prototype.getState = function()
{
  return this.state;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteSingleCoilResponse":69,"./util":73,"buffer":2}],69:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteSingleCoilResponse;

/**
 * The write single coil response (code 0x05).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an output address (2 bytes),
 *   - an output value (2 bytes).
 *
 * An output value of 0xFF00 means that the output is ON.
 * A value of 0x0000 means that it is OFF.
 *
 * @constructor
 * @extends {Response}
 * @param {number} address An address of the output.
 * Must be between 0x0000 and 0xFFFF.
 * @param {boolean} state A state of the output. `TRUE` - the coil is ON;
 * `FALSE` - the coil is OFF.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 */
function WriteSingleCoilResponse(address, state)
{
  Response.call(this, 0x05);

  /**
   * An address of the output. A number between 0x0000 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A state of the output. `TRUE` - the coil is ON; `FALSE` - the coil is OFF.
   *
   * @private
   * @type {boolean}
   */
  this.state = !!state;
}

util.inherits(WriteSingleCoilResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     An output address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `state` (boolean, required) -
 *     A state of the output.
 *     `TRUE` - the coil is ON; `FALSE` - the coil is OFF.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {boolean} [options.state]
 * @returns {WriteSingleCoilResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteSingleCoilResponse.fromOptions = function(options)
{
  return new WriteSingleCoilResponse(options.address, options.state);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteSingleCoilResponse} A response created from
 * its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
WriteSingleCoilResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x05);

  var address = buffer.readUInt16BE(1, true);
  var state = buffer.readUInt16BE(3, true) === 0xFF00;

  return new WriteSingleCoilResponse(address, state);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
WriteSingleCoilResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x05;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.state ? 0xFF00 : 0x0000, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteSingleCoilResponse.prototype.toString = function()
{
  return util.format(
    "0x05 (RES) Coil at address %d was turned %s",
    this.address,
    this.state ? 'ON': 'OFF'
  );
};

/**
 * @returns {number} An address of the output.
 */
WriteSingleCoilResponse.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {boolean} A state of the output.
 */
WriteSingleCoilResponse.prototype.getState = function()
{
  return this.state;
};

}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],70:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Request = require('./Request');
var WriteSingleRegisterResponse = require('./WriteSingleRegisterResponse');

module.exports = WriteSingleRegisterRequest;

/**
 * The write single register request (code 0x06).
 *
 * A binary representation of this request is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - a register address (2 bytes),
 *   - a register value (2 bytes).
 *
 * @constructor
 * @extends {Request}
 * @param {number} address A register address. A number between 0 and 0xFFFF.
 * @param {number} value A value of the register. A number between 0 and 65535.
 * @throws {Error} If the `address` is not a number between 0 and 0xFFFF.
 * @throws {Error} If the `value` is not a number between 0 and 65535.
 */
function WriteSingleRegisterRequest(address, value)
{
  Request.call(this, 0x06);

  /**
   * A register address. A number between 0 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A value of the register. A number between 0 and 65535.
   *
   * @private
   * @type {number}
   */
  this.value = util.prepareRegisterValue(value);
}

util.inherits(WriteSingleRegisterRequest, Request);

/**
 * Creates a new request from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     A register address. If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `value` (number, optional) -
 *     A value of the register. If specified, must be a number
 *     between 0 and 65535. Defaults to 0.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.value]
 * @returns {WriteSingleRegisterRequest} A response created
 * from the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteSingleRegisterRequest.fromOptions = function(options)
{
  return new WriteSingleRegisterRequest(options.address, options.value);
};

/**
 * Creates a new request from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this request.
 * @returns {WriteSingleRegisterRequest} A request created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this request.
 */
WriteSingleRegisterRequest.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x06);

  return new WriteSingleRegisterRequest(
    buffer.readUInt16BE(1, true),
    buffer.readUInt16BE(3, true)
  );
};

/**
 * Returns a binary representation of this request.
 *
 * @returns {Buffer} A binary representation of this request.
 */
WriteSingleRegisterRequest.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x06;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.value, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this request.
 *
 * @returns {string} A string representation of this request.
 */
WriteSingleRegisterRequest.prototype.toString = function()
{
  return util.format(
    "0x06 (REQ) Set the register at address %d to: %d",
    this.address,
    this.value
  );
};

/**
 * @param {Buffer} responseBuffer
 * @returns {Response}
 * @throws {Error}
 */
WriteSingleRegisterRequest.prototype.createResponse = function(responseBuffer)
{
  return this.createExceptionOrResponse(
    responseBuffer,
    WriteSingleRegisterResponse
  );
};

/**
 * @returns {number} A register address.
 */
WriteSingleRegisterRequest.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A value of the register.
 */
WriteSingleRegisterRequest.prototype.getValue = function()
{
  return this.value;
};

}).call(this,require("buffer").Buffer)
},{"./Request":54,"./WriteSingleRegisterResponse":71,"./util":73,"buffer":2}],71:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('./util');
var Response = require('./Response');

module.exports = WriteSingleRegisterResponse;

/**
 * The write single register response (code 0x06).
 *
 * A binary representation of this response is 5 bytes long and consists of:
 *
 *   - a function code (1 byte),
 *   - an output address (2 bytes),
 *   - a register value (2 bytes).
 *
 * @constructor
 * @extends {Response}
 * @param {number} address An address of the register.
 * Must be between 0x0000 and 0xFFFF.
 * @param {number} value A value of the register. Must be between 0 and 65535.
 * @throws {Error} If the `address` is not a number between 0x0000 and 0xFFFF.
 * @throws {Error} If the `value` is not a number between 0 and 65535.
 */
function WriteSingleRegisterResponse(address, value)
{
  Response.call(this, 0x06);

  /**
   * An address of the register. A number between 0x0000 and 0xFFFF.
   *
   * @private
   * @type {number}
   */
  this.address = util.prepareAddress(address);

  /**
   * A value of the register. A number between 0 and 65535.
   *
   * @private
   * @type {number}
   */
  this.value = util.prepareRegisterValue(value);
}

util.inherits(WriteSingleRegisterResponse, Response);

/**
 * Creates a new response from the specified `options`.
 *
 * Available options for this request are:
 *
 *   - `address` (number, optional) -
 *     An address of the register.
 *     If specified, must be a number between 0 and 0xFFFF.
 *     Defaults to 0.
 *
 *   - `value` (number, optional) -
 *     A value of the register.
 *     If specified, must be between 0 and 65535.
 *     Defaults to 0.
 *
 * @param {object} options An options object.
 * @param {number} [options.address]
 * @param {number} [options.value]
 * @returns {WriteSingleRegisterResponse} A response created from
 * the specified `options`.
 * @throws {Error} If any of the specified options are not valid.
 */
WriteSingleRegisterResponse.fromOptions = function(options)
{
  return new WriteSingleRegisterResponse(options.address, options.value);
};

/**
 * Creates a new response from its binary representation.
 *
 * @param {Buffer} buffer A binary representation of this response.
 * @returns {WriteSingleRegisterResponse} A response created
 * from its binary representation.
 * @throws {Error} If the specified buffer is not a valid binary representation
 * of this response.
 */
WriteSingleRegisterResponse.fromBuffer = function(buffer)
{
  util.assertBufferLength(buffer, 5);
  util.assertFunctionCode(buffer[0], 0x06);

  var address = buffer.readUInt16BE(1, true);
  var value = buffer.readUInt16BE(3, true);

  return new WriteSingleRegisterResponse(address, value);
};

/**
 * Returns a binary representation of this response.
 *
 * @returns {Buffer} A binary representation of this response.
 */
WriteSingleRegisterResponse.prototype.toBuffer = function()
{
  var buffer = new Buffer(5);

  buffer[0] = 0x06;
  buffer.writeUInt16BE(this.address, 1, true);
  buffer.writeUInt16BE(this.value, 3, true);

  return buffer;
};

/**
 * Returns a string representation of this response.
 *
 * @returns {string} A string representation of this response.
 */
WriteSingleRegisterResponse.prototype.toString = function()
{
  return util.format(
    "0x06 (RES) Register at address %d was set to: %d",
    this.address,
    this.value
  );
};

/**
 * @returns {number} An address of the register.
 */
WriteSingleRegisterResponse.prototype.getAddress = function()
{
  return this.address;
};

/**
 * @returns {number} A value of the register.
 */
WriteSingleRegisterResponse.prototype.getValue = function()
{
  return this.value;
};


}).call(this,require("buffer").Buffer)
},{"./Response":55,"./util":73,"buffer":2}],72:[function(require,module,exports){
'use strict';

exports.ExceptionResponse = require('./ExceptionResponse');
exports.ReadCoilsRequest = require('./ReadCoilsRequest');
exports.ReadCoilsResponse = require('./ReadCoilsResponse');
exports.ReadDiagnosticsRequest = require('./ReadDiagnosticsRequest');
exports.ReadDiagnosticsResponse = require('./ReadDiagnosticsResponse');
exports.ReadDiscreteInputsRequest = require('./ReadDiscreteInputsRequest');
exports.ReadDiscreteInputsResponse = require('./ReadDiscreteInputsResponse');
exports.ReadHoldingRegistersRequest = require('./ReadHoldingRegistersRequest');
exports.ReadHoldingRegistersResponse =
  require('./ReadHoldingRegistersResponse');
exports.ReadInputRegistersRequest = require('./ReadInputRegistersRequest');
exports.ReadInputRegistersResponse = require('./ReadInputRegistersResponse');

exports.ReportSlaveIdRequest = require('./ReportSlaveIdRequest');
exports.ReportSlaveIdResponse = require('./ReportSlaveIdResponse');

exports.WriteSingleCoilRequest = require('./WriteSingleCoilRequest');
exports.WriteSingleCoilResponse = require('./WriteSingleCoilResponse');
exports.WriteSingleRegisterRequest = require('./WriteSingleRegisterRequest');
exports.WriteSingleRegisterResponse = require('./WriteSingleRegisterResponse');
exports.WriteMultipleCoilsRequest = require('./WriteMultipleCoilsRequest');
exports.WriteMultipleCoilsResponse = require('./WriteMultipleCoilsResponse');
exports.WriteMultipleRegistersRequest =
  require('./WriteMultipleRegistersRequest');
exports.WriteMultipleRegistersResponse =
  require('./WriteMultipleRegistersResponse');
exports.ReadFileRecordRequest = require('./ReadFileRecordRequest');
exports.ReadFileRecordResponse = require('./ReadFileRecordResponse');
exports.WriteFileRecordRequest = require('./WriteFileRecordRequest');
exports.WriteFileRecordResponse = require('./WriteFileRecordResponse');

exports.ReadFifo8Request = require('./ReadFifo8Request');
exports.ReadFifo8Response = require('./ReadFifo8Response');

exports.WriteFifo8Request = require('./WriteFifo8Request');
exports.WriteFifo8Response = require('./WriteFifo8Response');

exports.ReadObjectRequest = require('./ReadObjectRequest');
exports.ReadObjectResponse = require('./ReadObjectResponse');

exports.WriteObjectRequest = require('./WriteObjectRequest');
exports.WriteObjectResponse = require('./WriteObjectResponse');

exports.ReadMemoryRequest = require('./ReadMemoryRequest');
exports.ReadMemoryResponse = require('./ReadMemoryResponse');

exports.WriteMemoryRequest = require('./WriteMemoryRequest');
exports.WriteMemoryResponse = require('./WriteMemoryResponse');

exports.CommandRequest = require('./CommandRequest');
exports.CommandResponse = require('./CommandResponse');

exports[0x01] = exports.ReadCoilsRequest;
exports[0x02] = exports.ReadDiscreteInputsRequest;
exports[0x03] = exports.ReadHoldingRegistersRequest;
exports[0x04] = exports.ReadInputRegistersRequest;
exports[0x05] = exports.WriteSingleCoilRequest;
exports[0x06] = exports.WriteSingleRegisterRequest;
exports[0x08] = exports.ReadDiagnosticsRequest;
exports[0x0F] = exports.WriteMultipleCoilsRequest;
exports[0x10] = exports.WriteMultipleRegistersRequest;
exports[0x11] = exports.ReportSlaveIdRequest;
exports[0x14] = exports.ReadFileRecordRequest;
exports[0x15] = exports.WriteFileRecordRequest;
exports[0x41] = exports.ReadFifo8Request;
exports[0x42] = exports.WriteFifoRequest;
exports[0x43] = exports.ReadObjectRequest;
exports[0x44] = exports.WriteObjectRequest;
exports[0x45] = exports.ReadMemoryRequest;
exports[0x46] = exports.WriteMemoryRequest;
exports[0x47] = exports.CommandRequest;

},{"./CommandRequest":31,"./CommandResponse":32,"./ExceptionResponse":33,"./ReadCoilsRequest":34,"./ReadCoilsResponse":35,"./ReadDiagnosticsRequest":36,"./ReadDiagnosticsResponse":37,"./ReadDiscreteInputsRequest":38,"./ReadDiscreteInputsResponse":39,"./ReadFifo8Request":40,"./ReadFifo8Response":41,"./ReadFileRecordRequest":42,"./ReadFileRecordResponse":43,"./ReadHoldingRegistersRequest":44,"./ReadHoldingRegistersResponse":45,"./ReadInputRegistersRequest":46,"./ReadInputRegistersResponse":47,"./ReadMemoryRequest":48,"./ReadMemoryResponse":49,"./ReadObjectRequest":50,"./ReadObjectResponse":51,"./ReportSlaveIdRequest":52,"./ReportSlaveIdResponse":53,"./WriteFifo8Request":56,"./WriteFifo8Response":57,"./WriteFileRecordRequest":58,"./WriteFileRecordResponse":59,"./WriteMemoryRequest":60,"./WriteMemoryResponse":61,"./WriteMultipleCoilsRequest":62,"./WriteMultipleCoilsResponse":63,"./WriteMultipleRegistersRequest":64,"./WriteMultipleRegistersResponse":65,"./WriteObjectRequest":66,"./WriteObjectResponse":67,"./WriteSingleCoilRequest":68,"./WriteSingleCoilResponse":69,"./WriteSingleRegisterRequest":70,"./WriteSingleRegisterResponse":71}],73:[function(require,module,exports){
/*jshint maxparams:5*/

'use strict';

var util = require('util');

/**
 * @type {function(string, ...[*]): string}
 */
exports.format = util.format;

/**
 * @type {function(function, function)}
 */
exports.inherits = util.inherits;

/**
 * @param {number} actualCode
 * @param {number} expectedCode
 * @throws {Error}
 */
exports.assertFunctionCode = function(actualCode, expectedCode)
{
  if (actualCode !== expectedCode)
  {
    throw new Error(util.format(
      "Expected function code to be '%d', got '%d'",
      expectedCode,
      actualCode
    ));
  }
};

/**
 * @param {Buffer} buffer
 * @param {number} minLength
 * @throws {Error}
 */
exports.assertBufferLength = function(buffer, minLength)
{
  if (buffer.length < minLength)
  {
    throw new Error(util.format(
      "The specified buffer must be at least '%d' bytes long.", minLength
    ));
  }
};

/**
 * @param {*} address
 * @returns {number}
 * @throws {Error}
 */
exports.prepareAddress = function(address)
{
  return prepareNumericOption(
    address, 0, 0, 65535, 'A starting address'
  );
};

/**
 * @param {*} quantity
 * @param {number} maxQuantity
 * @returns {number}
 * @throws {Error}
 */
exports.prepareQuantity = function(quantity, maxQuantity)
{
  return prepareNumericOption(
    quantity, 1, 1, maxQuantity, 'Quantity'
  );
};

/**
 * @param {*} registerValue
 * @returns {number}
 * @throws {Error}
 */
exports.prepareRegisterValue = function(registerValue)
{
  return prepareNumericOption(
    registerValue, 0, 0, 65535, 'Register value'
  );
};

exports.prepareNumericOption = prepareNumericOption;

/**
 * @param {*} value
 * @param {number} defaultValue
 * @param {number} min
 * @param {number} max
 * @param {string} label
 */
function prepareNumericOption(value, defaultValue, min, max, label)
{
  if (typeof value === 'undefined')
  {
    return defaultValue;
  }

  value = parseInt(value, 10);

  if (isNaN(value) || value < min || value > max)
  {
    throw new Error(util.format(
      "%s must be a number between %d and %d.",
      label,
      min,
      max
    ));
  }

  return value;
}

},{"util":10}],74:[function(require,module,exports){
'use strict';

var Master = require('./Master');
var functions = require('./functions');

/**
 * @private
 * @const
 * @type {object.<string, function(object): Connection>}
 */
var connectionFactories = {
  'tcp': function createTcpConnection(options)
  {
    return new (require('./connections/TcpConnection'))(options);
  },
  'udp': function createUdpConnection(options)
  {
    return new (require('./connections/UdpConnection'))(options);
  },
  'serial': function createSerialConnection(options)
  {
    return new (require('./connections/SerialConnection'))(options.serialPort);
  },
  'websocket': function createWebsocketConnection(options)
  {
    return new (require('./connections/WebsocketConnection'))(options.socket);
  },
  'ble': function createBleConnection(options)
  {
    return new (require('./connections/BleConnection'))(options.device);
  },
  'none': function createNoConnection(options)
  {
    return new (require('./connections/NoConnection'))(options);
  }
};

/**
 * @private
 * @const
 * @type {object.<string, function(object): Transport>}
 */
var transportFactories = {
  'ip': function createIpTransport(options)
  {
    return new (require('./transports/IpTransport'))(
      createConnection(options.connection)
    );
  },
  'ascii': function createAsciiTransport(options)
  {
    return new (require('./transports/AsciiTransport'))(
      createConnection(options.connection)
    );
  },
  'rtu': function createRtuTransport(options)
  {
    options.connection = createConnection(options.connection);

    return new (require('./transports/RtuTransport'))(options);
  },
  'tunnel': function createTunnelTransport(options)
  {
    options.connection = createConnection(options.connection);

    return new (require('./transports/TunnelTransport'))(options);
  }
};

/**
 * @private
 * @param {object} [options]
 * @param {string} [options.type]
 * @returns {Connection}
 * @throws {Error} If any of the specified options are invalid.
 */
function createConnection(options)
{
  if (typeof options !== 'object')
  {
    options = {};
  }

  if (typeof options.type !== 'string')
  {
    options.type = 'tcp';
  }

  var connectionFactory = connectionFactories[options.type];

  if (typeof connectionFactory === 'undefined')
  {
    throw new Error("Unknown connection type: " + options.type);
  }

  return connectionFactory(options);
}

/**
 * @private
 * @param {object} [options]
 * @param {string} [options.type]
 * @param {object} [options.connection]
 * @returns {Transport}
 * @throws {Error} If any of the specified options are invalid.
 */
function createTransport(options)
{
  if (typeof options !== 'object')
  {
    options = {};
  }

  if (typeof options.type !== 'string')
  {
    options.type = 'ip';
  }

  var transportFactory = transportFactories[options.type];

  if (typeof transportFactory === 'undefined')
  {
    throw new Error("Unknown transport type: " + options.type);
  }

  return transportFactory(options);
}

/**
 * @param {object} [options]
 * @param {object} [options.transport]
 * @param {boolean} [options.retryOnException]
 * @param {number} [options.maxConcurrentRequests]
 * @param {number} [options.defaultUnit]
 * @param {number} [options.defaultMaxRetries]
 * @param {number} [options.defaultTimeout]
 * @returns {Master}
 * @throws {Error} If any of the specified options are invalid.
 */
function createMaster(options)
{
  if (typeof options === 'undefined')
  {
    options = {};
  }

  options.transport = createTransport(options.transport);
  options = new Master.Options(options);

  return new Master(options);
}

module.exports = {
  createMaster: createMaster,
  functions: functions,
  Register: require('./Register')
};

},{"./Master":19,"./Register":21,"./connections/BleConnection":24,"./connections/NoConnection":25,"./connections/SerialConnection":26,"./connections/TcpConnection":27,"./connections/UdpConnection":28,"./connections/WebsocketConnection":29,"./functions":72,"./transports/AsciiTransport":75,"./transports/IpTransport":76,"./transports/RtuTransport":77,"./transports/TunnelTransport":78}],75:[function(require,module,exports){
(function (Buffer){
'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var errors = require('../errors');
var Transport = require('../Transport');

module.exports = AsciiTransport;

/**
 * @private
 * @const
 * @type {number}
 */
var FRAME_START = 0x3A;

/**
 * @private
 * @const
 * @type {number}
 */
var FRAME_CR = 0x0D;

/**
 * @private
 * @const
 * @type {number}
 */
var FRAME_LF = 0x0A;

/**
 * @constructor
 * @extends {Transport}
 * @param {Connection} connection
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function AsciiTransport(connection)
{
  Transport.call(this, connection);

  /**
   * @private
   * @type {Transaction}
   */
  this.transaction = null;

  /**
   * @private
   * @type {h5.buffers.BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @private
   * @type {number}
   */
  this.lastByte = -1;

  /**
   * @private
   * @type {function(function)}
   */
  this.handleTimeout = this.handleTimeout.bind(this);

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(AsciiTransport, Transport);

AsciiTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transaction !== null)
  {
    this.transaction.destroy();
    this.transaction = null;
  }
};

/**
 * @param {Transaction} transaction
 * @throws {Error}
 */
AsciiTransport.prototype.sendRequest = function(transaction)
{
  if (this.transaction !== null)
  {
    throw new Error(
      "Can not send another request while the previous one "
        + "has not yet completed."
    );
  }

  this.transaction = transaction;

  var adu = this.getAdu(transaction);

  this.emit('request', transaction);

  this.connection.write(adu);

  transaction.start(this.handleTimeout);
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
AsciiTransport.prototype.getAdu = function(transaction)
{
  var adu = transaction.getAdu();

  if (adu === null)
  {
    adu = this.buildAdu(transaction);
  }

  return adu;
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
AsciiTransport.prototype.buildAdu = function(transaction)
{
  var request = transaction.getRequest();
  var pdu = request.toBuffer();
  var adu = this.frame(transaction.getUnit(), pdu);

  transaction.setAdu(adu);

  return adu;
};

/**
 * @private
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
AsciiTransport.prototype.frame = function(unit, pdu)
{
  var frame = new Buffer(7 + pdu.length * 2);
  var i = 0;

  frame[i++] = FRAME_START;
  frame[i++] = this.encodeNibble(this.high(unit));
  frame[i++] = this.encodeNibble(this.low(unit));

  for (var j = 0, l = pdu.length; j < l; ++j)
  {
    frame[i++] = this.encodeNibble(this.high(pdu[j]));
    frame[i++] = this.encodeNibble(this.low(pdu[j]));
  }

  var checksum = this.lrc(unit, pdu);

  frame[i++] = this.encodeNibble(this.high(checksum));
  frame[i++] = this.encodeNibble(this.low(checksum));
  frame[i++] = FRAME_CR;
  frame[i] = FRAME_LF;

  return frame;
};

/**
 * @private
 * @param {number} initial
 * @param {Buffer|Array.<number>} buffer
 * @returns {number}
 */
AsciiTransport.prototype.lrc = function(initial, buffer)
{
  var result = initial & 0xFF;

  for (var i = 0, l = buffer.length; i < l; ++i)
  {
    result += buffer[i] & 0xFF;
  }

  return ((result ^ 0xFF) + 1) & 0xFF;
};

/**
 * @private
 * @param {number} byt3
 * @returns {number}
 */
AsciiTransport.prototype.high = function(byt3)
{
  return ((byt3 & 0xF0) >>> 4) & 0xFF;
};

/**
 * @private
 * @param {number} byt3
 * @returns {number}
 */
AsciiTransport.prototype.low = function(byt3)
{
  return ((byt3 & 0x0F) >>> 0) & 0xFF;
};

/**
 * @private
 * @param {number} nibble
 * @returns {number}
 */
AsciiTransport.prototype.encodeNibble = function(nibble)
{
  return nibble + (nibble < 10 ? 48 : 55);
};

/**
 * @private
 * @param {number} nibble
 * @returns {number}
 */
AsciiTransport.prototype.decodeNibble = function(nibble)
{
  return nibble - (nibble < 65 ? 48 : 55);
};

/**
 * @private
 * @param {number} highNibble
 * @param {number} lowNibble
 * @returns {number}
 */
AsciiTransport.prototype.decodeByte = function(highNibble, lowNibble)
{
  return (this.decodeNibble(highNibble) << 4)
    + (this.decodeNibble(lowNibble) << 0);
};

/**
 * @private
 * @param {Array.<number>} bytes
 * @returns {Array.<number>}
 */
AsciiTransport.prototype.decodeBytes = function(bytes)
{
  var result = [];

  while (bytes.length > 0)
  {
    result.push(this.decodeByte(bytes.shift(), bytes.shift()));
  }

  return result;
};

/**
 * @private
 */
AsciiTransport.prototype.handleTimeout = function()
{
  this.skipResponseData();
};

/**
 * @private
 */
AsciiTransport.prototype.skipResponseData = function()
{
  if (this.reader.length > 0)
  {
    this.reader.skip(this.reader.length);
  }

  this.transaction = null;
};

/**
 * @private
 * @param {Buffer} data
 */
AsciiTransport.prototype.onData = function(data)
{
  var transaction = this.transaction;

  if (transaction === null)
  {
    return;
  }

  if (!this.isValidChunk(data))
  {
    this.skipResponseData();

    transaction.handleError(new errors.InvalidResponseDataError());

    return;
  }

  this.reader.push(data);

  if (this.endsWithCrLf(data))
  {
    this.handleFrameData();
  }
};

/**
 * @private
 * @param {Buffer} chunk
 * @returns {boolean}
 */
AsciiTransport.prototype.isValidChunk = function(chunk)
{
  return this.reader.length > 0 || chunk[0] === FRAME_START;
};

/**
 * @private
 * @param {Buffer} chunk
 * @returns {boolean}
 */
AsciiTransport.prototype.endsWithCrLf = function(chunk)
{
  var lastByte = this.lastByte;

  this.lastByte = chunk[chunk.length - 1];

  if (chunk.length === 1)
  {
    return lastByte === FRAME_CR && chunk[0] === FRAME_LF;
  }

  return chunk[chunk.length - 2] === FRAME_CR && this.lastByte === FRAME_LF;
};

/**
 * @private
 */
AsciiTransport.prototype.handleFrameData = function()
{
  this.reader.skip(1);

  var frame = this.decodeBytes(this.reader.shiftBytes(this.reader.length - 2));
  var checksum = frame.pop();
  var transaction = this.transaction;

  this.skipResponseData();

  var validationError = this.validate(transaction, frame, checksum);

  if (validationError !== null)
  {
    transaction.handleError(validationError);

    return;
  }

  var request = transaction.getRequest();

  try
  {
    transaction.handleResponse(request.createResponse(new Buffer(frame)));
  }
  catch (error)
  {
    transaction.handleError(error);
  }
};

/**
 * @private
 * @param {Transaction} transaction
 * @param {Array.<number>} frame
 * @param {number} expectedChecksum
 * @returns {Error|null}
 */
AsciiTransport.prototype.validate =
  function(transaction, frame, expectedChecksum)
{
  var actualChecksum = this.lrc(0, frame);

  if (actualChecksum !== expectedChecksum)
  {
    return new errors.InvalidChecksumError();
  }

  var expectedUnit = transaction.getUnit();
  var actualUnit = frame.shift();

  if (actualUnit !== expectedUnit)
  {
    return new errors.InvalidResponseDataError(util.format(
      "Invalid unit specified in the MODBUS response. Expected: %d, got: %d.",
      expectedUnit,
      actualUnit
    ));
  }

  return null;
};

}).call(this,require("buffer").Buffer)
},{"../Transport":23,"../errors":30,"buffer":2,"h5.buffers":83,"util":10}],76:[function(require,module,exports){
'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var Transport = require('../Transport');
var InvalidResponseDataError = require('../errors').InvalidResponseDataError;

module.exports = IpTransport;

/**
 * @constructor
 * @extends {Transport}
 * @param {Connection} connection
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function IpTransport(connection)
{
  Transport.call(this, connection);

  /**
   * @type {h5.buffers.BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @type {IpTransport.Header}
   */
  this.header = new IpTransport.Header();

  /**
   * @private
   * @type {number}
   */
  this.nextTransactionId = 0;

  /**
   * @private
   * @type {object.<number, Transaction>}
   */
  this.transactions = {};

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(IpTransport, Transport);

/**
 * @constructor
 */
IpTransport.Header = function()
{
  /**
   * @type {number}
   */
  this.id = -1;

  /**
   * @type {number}
   */
  this.version = -1;

  /**
   * @type {number}
   */
  this.length = -1;

  /**
   * @type {number}
   */
  this.unit = -1;
};

/**
 * @param {h5.buffers.BufferQueueReader} bufferReader
 */
IpTransport.Header.prototype.read = function(bufferReader)
{
  this.id = bufferReader.shiftUInt16();
  this.version = bufferReader.shiftUInt16();
  this.length = bufferReader.shiftUInt16() - 1;
  this.unit = bufferReader.shiftByte();
};

/**
 * @param {Transaction} transaction
 * @returns {InvalidResponseDataError|null}
 */
IpTransport.Header.prototype.validate = function(transaction)
{
  var message;
  var expectedUnit = transaction.getUnit();

  if (this.version !== 0)
  {
    message = util.format(
      "Invalid version specified in the MODBUS response header. "
        + "Expected: 0, got: %d",
      this.version
    );
  }
  else if (this.length === 0)
  {
    message = "Invalid length specified in the MODBUS response header. "
      + "Expected: at least 1, got: 0.";
  }
  else if (this.unit !== expectedUnit)
  {
    message = util.format(
      "Invalid unit specified in the MODBUS response header. "
        + "Expected: %d, got: %d.",
      expectedUnit,
      this.unit
    );
  }

  return typeof message === 'undefined'
    ? null
    : new InvalidResponseDataError(message);
};

IpTransport.Header.prototype.reset = function()
{
  this.id = -1;
  this.version = -1;
  this.length = -1;
  this.unit = -1;
};

IpTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transactions !== null)
  {
    Object.keys(this.transactions).forEach(function(id)
    {
      this.transactions[id].destroy();
    }, this);

    this.transactions = null;
  }
};

/**
 * @param {Transaction} transaction
 */
IpTransport.prototype.sendRequest = function(transaction)
{
  var id = this.getNextTransactionId();
  var adu = this.getAdu(id, transaction);

  this.transactions[id] = transaction;

  this.emit('request', transaction);

  this.connection.write(adu);

  transaction.start(this.createTimeoutHandler(id));
};

/**
 * @private
 * @returns {number}
 */
IpTransport.prototype.getNextTransactionId = function()
{
  if (++this.nextTransactionId === 0xFFFF)
  {
    this.nextTransactionId = 0;
  }

  return this.nextTransactionId;
};

/**
 * @private
 * @param {number} id
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
IpTransport.prototype.getAdu = function(id, transaction)
{
  var adu = transaction.getAdu();

  if (adu === null)
  {
    adu = this.buildAdu(id, transaction);
  }
  else
  {
    adu.writeUInt16BE(id, 0);
  }

  return adu;
};

/**
 * @private
 * @param {number} id
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
IpTransport.prototype.buildAdu = function(id, transaction)
{
  var request = transaction.getRequest();
  var pdu = request.toBuffer();
  var adu = this.frame(id, transaction.getUnit(), pdu);

  transaction.setAdu(adu);

  return adu;
};

/**
 * @private
 * @param {number} id
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
IpTransport.prototype.frame = function(id, unit, pdu)
{
  var builder = new buffers.BufferBuilder();

  builder.pushUInt16(id);
  builder.pushUInt16(0);
  builder.pushUInt16(pdu.length + 1);
  builder.pushByte(unit);
  builder.pushBuffer(pdu);

  return builder.toBuffer();
};

/**
 * @private
 * @param {number} id
 * @returns {function}
 */
IpTransport.prototype.createTimeoutHandler = function(id)
{
  var transactions = this.transactions;

  return function()
  {
    if (typeof transactions[id] !== 'undefined')
    {
      delete transactions[id];
    }
  };
};

/**
 * @private
 * @param {Buffer} [data]
 */
IpTransport.prototype.onData = function(data)
{
  if (typeof data !== 'undefined')
  {
    this.reader.push(data);
  }

  if (this.header.id === -1 && this.reader.length >= 7)
  {
    this.header.read(this.reader);
  }

  if (this.header.id !== -1 && this.reader.length >= this.header.length)
  {
    this.handleFrameData();
  }
};

/**
 * @private
 */
IpTransport.prototype.handleFrameData = function()
{
  var transaction = this.transactions[this.header.id];

  if (typeof transaction === 'undefined')
  {
    this.skipResponseData();
    this.onData();

    return;
  }

  delete this.transactions[this.header.id];

  var validationError = this.header.validate(transaction);

  if (validationError !== null)
  {
    this.skipResponseData();

    transaction.handleError(validationError);

    this.onData();

    return;
  }

  var responseBuffer = this.reader.shiftBuffer(this.header.length);

  this.header.reset();

  var request = transaction.getRequest();

  try
  {
    transaction.handleResponse(request.createResponse(responseBuffer));
  }
  catch (error)
  {
    transaction.handleError(error);
  }

  this.onData();
};

/**
 * @private
 */
IpTransport.prototype.skipResponseData = function()
{
  if (this.header.length > 0)
  {
    this.reader.skip(this.header.length);
  }

  this.header.reset();
};

},{"../Transport":23,"../errors":30,"h5.buffers":83,"util":10}],77:[function(require,module,exports){
'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var errors = require('../errors');
var Transport = require('../Transport');

module.exports = RtuTransport;

/**
 * @private
 * @const
 * @type {number}
 */
var MIN_FRAME_LENGTH = 5;

/**
 * @private
 * @const
 * @type {Array.<number>}
 */
var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
];

/**
 * @constructor
 * @extends {Transport}
 * @param {RtuTransport.Options|object} options
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function RtuTransport(options)
{
  /**
   * @private
   * @type {RtuTransport.Options}
   */
  this.options = options instanceof RtuTransport.Options
    ? options
    : new RtuTransport.Options(options);

  Transport.call(this, this.options.connection);

  /**
   * @private
   * @type {Transaction}
   */
  this.transaction = null;

  /**
   * @private
   * @type {BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @private
   * @type {number|null}
   */
  this.eofTimer = null;

  /**
   * @private
   * @type {function}
   */
  this.handleFrameData = this.handleFrameData.bind(this);

  /**
   * @private
   * @type {function}
   */
  this.handleTimeout = this.handleTimeout.bind(this);

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(RtuTransport, Transport);

/**
 * @constructor
 * @param {object} options
 * @param {Connection} options.connection
 * @param {number} [options.eofTimeout]
 */
RtuTransport.Options = function(options)
{
  /**
   * @type {Connection}
   */
  this.connection = options.connection;

  /**
   * @type {number}
   */
  this.eofTimeout =
    typeof options.eofTimeout === 'number' && options.eofTimeout >= 1
      ? options.eofTimeout
      : 10;
};

RtuTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transaction !== null)
  {
    this.transaction.destroy();
    this.transaction = null;
  }

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
    this.eofTimer = null;
  }
};

/**
 * @param {Transaction} transaction
 * @throws {Error}
 */
RtuTransport.prototype.sendRequest = function(transaction)
{
  if (this.transaction !== null)
  {
    throw new Error(
      "Can not send another request while the previous one "
        + "has not yet completed."
    );
  }

  this.transaction = transaction;

  var adu = this.getAdu(transaction);

  this.emit('request', transaction);

  this.connection.write(adu);

  transaction.start(this.handleTimeout);
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
RtuTransport.prototype.getAdu = function(transaction)
{
  var adu = transaction.getAdu();

  if (adu === null)
  {
    adu = this.buildAdu(transaction);
  }

  return adu;
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
RtuTransport.prototype.buildAdu = function(transaction)
{
  var request = transaction.getRequest();
  var pdu = request.toBuffer();
  var adu = this.frame(transaction.getUnit(), pdu);

  transaction.setAdu(adu);

  return adu;
};

/**
 * @private
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
RtuTransport.prototype.frame = function(unit, pdu)
{
  var builder = new buffers.BufferBuilder();

  builder.pushByte(unit);
  builder.pushBuffer(pdu);
  builder.pushUInt16(this.crc16(unit, pdu), true);

  return builder.toBuffer();
};

/**
 * @private
 * @param {number} firstByte
 * @param {Buffer} buffer
 * @returns {number}
 */
RtuTransport.prototype.crc16 = function(firstByte, buffer)
{
  var crc = 0xFFFF;
  var j;

  if (firstByte !== -1)
  {
    j = (crc ^ firstByte) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  for (var i = 0, l = buffer.length; i < l; ++i)
  {
    j = (crc ^ buffer[i]) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  return crc;
};

/**
 * @private
 */
RtuTransport.prototype.handleTimeout = function()
{
  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.skipResponseData();
};

/**
 * @private
 */
RtuTransport.prototype.skipResponseData = function()
{
  if (this.reader.length > 0)
  {
    this.reader.skip(this.reader.length);
  }

  this.transaction = null;
};

/**
 * @private
 * @param {Buffer} data
 */
RtuTransport.prototype.onData = function(data)
{
  if (this.transaction === null)
  {
    return;
  }

  this.reader.push(data);

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.eofTimer = setTimeout(this.handleFrameData, this.options.eofTimeout);
};

/**
 * @private
 */
RtuTransport.prototype.handleFrameData = function()
{
  var transaction = this.transaction;

  if (this.reader.length < MIN_FRAME_LENGTH)
  {
    this.skipResponseData();

    transaction.handleError(new errors.IncompleteResponseFrameError());

    return;
  }

  var unit = this.reader.shiftByte();
  var responseBuffer = this.reader.shiftBuffer(this.reader.length - 2);
  var checksum = this.reader.shiftUInt16(true);

  this.skipResponseData();

  var validationError = this.validate(
    transaction,
    unit,
    responseBuffer,
    checksum
  );

  if (validationError !== null)
  {
    transaction.handleError(validationError);

    return;
  }

  var request = transaction.getRequest();

  try
  {
    transaction.handleResponse(request.createResponse(responseBuffer));
  }
  catch (error)
  {
    transaction.handleError(error);
  }
};

/**
 * @private
 * @param {Transaction} transaction
 * @param {number} actualUnit
 * @param {Buffer} responseBuffer
 * @param {number} expectedChecksum
 * @returns {Error|null}
 */
RtuTransport.prototype.validate =
  function(transaction, actualUnit, responseBuffer, expectedChecksum)
{
  var actualChecksum = this.crc16(actualUnit, responseBuffer);

  if (actualChecksum !== expectedChecksum)
  {
    return new errors.InvalidChecksumError();
  }

  var expectedUnit = transaction.getUnit();

  if (actualUnit !== expectedUnit)
  {
    return new errors.InvalidResponseDataError(util.format(
      "Invalid unit specified in the MODBUS response. Expected: %d, got: %d.",
      expectedUnit,
      actualUnit
    ));
  }

  return null;
};

},{"../Transport":23,"../errors":30,"h5.buffers":83,"util":10}],78:[function(require,module,exports){
(function (Buffer){
/**
 * Implements a custom transport that allows us to behave like a slave but
 * tunnel messages to the master.  This is a non-standard MODBUS extension.
 *
 * An example scenario would be that we are a temporary device (like a diagnostic device)
 * connected to a functioning multi-drop MODBUS network.  Because the network already has
 * a functioning master, we can't blast in and act like a master, even if we would like
 * to query or request status.  According to the MODBUS rules, we can only 'speak when spoken to'.
 * The permanent master in such a network will periodically send out a poll to see if
 * we want to say something.
 *
 * The transport framing is RTU; however when a request is to be send, we wait until
 * polled by the master before sending it, and we have to wait until the next poll (at least)
 * before we get a response.  Transaction Timeouts for this kind of transport will be much longer than
 * normal RTU timeouts, and will depend on the polling rate set up in the permanent master.
 *
 */

'use strict';

var util = require('util');
var buffers = require('h5.buffers');
var errors = require('../errors');
var Transport = require('../Transport');

module.exports = TunnelTransport;


/**
 * MODBUS function code for tunneling message (per Control Solutions DOC0003824A-SRS-A)
 * @private
 * @const
 * @type {number}
 */
var SLAVE_COMMAND = 71;

/**
 * @private
 * @const
 * @type {Array.<number>}
 */
var CRC_TABLE = [
  0x0000, 0xC0C1, 0xC181, 0x0140, 0xC301, 0x03C0, 0x0280, 0xC241,
  0xC601, 0x06C0, 0x0780, 0xC741, 0x0500, 0xC5C1, 0xC481, 0x0440,
  0xCC01, 0x0CC0, 0x0D80, 0xCD41, 0x0F00, 0xCFC1, 0xCE81, 0x0E40,
  0x0A00, 0xCAC1, 0xCB81, 0x0B40, 0xC901, 0x09C0, 0x0880, 0xC841,
  0xD801, 0x18C0, 0x1980, 0xD941, 0x1B00, 0xDBC1, 0xDA81, 0x1A40,
  0x1E00, 0xDEC1, 0xDF81, 0x1F40, 0xDD01, 0x1DC0, 0x1C80, 0xDC41,
  0x1400, 0xD4C1, 0xD581, 0x1540, 0xD701, 0x17C0, 0x1680, 0xD641,
  0xD201, 0x12C0, 0x1380, 0xD341, 0x1100, 0xD1C1, 0xD081, 0x1040,
  0xF001, 0x30C0, 0x3180, 0xF141, 0x3300, 0xF3C1, 0xF281, 0x3240,
  0x3600, 0xF6C1, 0xF781, 0x3740, 0xF501, 0x35C0, 0x3480, 0xF441,
  0x3C00, 0xFCC1, 0xFD81, 0x3D40, 0xFF01, 0x3FC0, 0x3E80, 0xFE41,
  0xFA01, 0x3AC0, 0x3B80, 0xFB41, 0x3900, 0xF9C1, 0xF881, 0x3840,
  0x2800, 0xE8C1, 0xE981, 0x2940, 0xEB01, 0x2BC0, 0x2A80, 0xEA41,
  0xEE01, 0x2EC0, 0x2F80, 0xEF41, 0x2D00, 0xEDC1, 0xEC81, 0x2C40,
  0xE401, 0x24C0, 0x2580, 0xE541, 0x2700, 0xE7C1, 0xE681, 0x2640,
  0x2200, 0xE2C1, 0xE381, 0x2340, 0xE101, 0x21C0, 0x2080, 0xE041,
  0xA001, 0x60C0, 0x6180, 0xA141, 0x6300, 0xA3C1, 0xA281, 0x6240,
  0x6600, 0xA6C1, 0xA781, 0x6740, 0xA501, 0x65C0, 0x6480, 0xA441,
  0x6C00, 0xACC1, 0xAD81, 0x6D40, 0xAF01, 0x6FC0, 0x6E80, 0xAE41,
  0xAA01, 0x6AC0, 0x6B80, 0xAB41, 0x6900, 0xA9C1, 0xA881, 0x6840,
  0x7800, 0xB8C1, 0xB981, 0x7940, 0xBB01, 0x7BC0, 0x7A80, 0xBA41,
  0xBE01, 0x7EC0, 0x7F80, 0xBF41, 0x7D00, 0xBDC1, 0xBC81, 0x7C40,
  0xB401, 0x74C0, 0x7580, 0xB541, 0x7700, 0xB7C1, 0xB681, 0x7640,
  0x7200, 0xB2C1, 0xB381, 0x7340, 0xB101, 0x71C0, 0x7080, 0xB041,
  0x5000, 0x90C1, 0x9181, 0x5140, 0x9301, 0x53C0, 0x5280, 0x9241,
  0x9601, 0x56C0, 0x5780, 0x9741, 0x5500, 0x95C1, 0x9481, 0x5440,
  0x9C01, 0x5CC0, 0x5D80, 0x9D41, 0x5F00, 0x9FC1, 0x9E81, 0x5E40,
  0x5A00, 0x9AC1, 0x9B81, 0x5B40, 0x9901, 0x59C0, 0x5880, 0x9841,
  0x8801, 0x48C0, 0x4980, 0x8941, 0x4B00, 0x8BC1, 0x8A81, 0x4A40,
  0x4E00, 0x8EC1, 0x8F81, 0x4F40, 0x8D01, 0x4DC0, 0x4C80, 0x8C41,
  0x4400, 0x84C1, 0x8581, 0x4540, 0x8701, 0x47C0, 0x4680, 0x8641,
  0x8201, 0x42C0, 0x4380, 0x8341, 0x4100, 0x81C1, 0x8081, 0x4040
];

/**
 * @constructor
 * @extends {Transport}
 * @param {TunnelTransport.Options|object} options
 * @event request Emitted right before the ADU is passed to the underlying
 * `Connection`.
 */
function TunnelTransport(options)
{
  /**
   * @private
   * @type {TunnelTransport.Options}
   */
  this.options = options instanceof TunnelTransport.Options
    ? options
    : new TunnelTransport.Options(options);

  Transport.call(this, this.options.connection);

  /**
   * @private
   * @type {Transaction}
   */
  this.transaction = null;
  this.nextTransaction = null;

  /**
   * @private
   * @type {BufferQueueReader}
   */
  this.reader = new buffers.BufferQueueReader();

  /**
   * @private
   * @type {number|null}
   */
  this.eofTimer = null;


  /**
   * @private
   * @type {number}
   */
  this.sequence = 0;

  /**
   * @private
   * @type {function}
   */
  this.handleFrameData = this.handleFrameData.bind(this);

  /**
   * @private
   * @type {function}
   */
  this.handleTimeout = this.handleTimeout.bind(this);

  this.connection.on('data', this.onData.bind(this));
}

util.inherits(TunnelTransport, Transport);

/**
 * @constructor
 * @param {object} options
 * @param {Connection} options.connection
 * @param {number} [options.eofTimeout]
 * @param {number} [options.slaveId]
 */
TunnelTransport.Options = function(options)
{
  /**
   * @type {Connection}
   */
  this.connection = options.connection;

  /**
   * @type {number}
   */
  this.eofTimeout =
    typeof options.eofTimeout === 'number' && options.eofTimeout >= 1
      ? options.eofTimeout
      : 10;

  /**
   * @type {number}
   */
  this.slaveId =
    typeof options.slaveId === 'number' && options.slaveId >= 0
      ? options.slaveId
      : 127;
};

TunnelTransport.prototype.destroy = function()
{
  this.removeAllListeners();

  this.options = null;

  if (this.connection !== null)
  {
    this.connection.destroy();
    this.connection = null;
  }

  if (this.transaction !== null)
  {
    this.transaction.destroy();
    this.transaction = null;
  }

  if (this.nextTransaction !== null)
  {
    this.nextTransaction.destroy();
    this.nextTransaction = null;
  }

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
    this.eofTimer = null;
  }
};

/**
 * Starts a new outgoing transaction.
 *
 * With this transport, we get the ADU ready
 * but don't launch it until the bus master
 * requests it with a SLAVE_COMMAND function code
 *
 * @param {Transaction} transaction
 * @throws {Error}
 */
TunnelTransport.prototype.sendRequest = function(transaction)
{

  // we keep track of a current transaction and a next transaction
  // but that's all... if master sends more than that, throw
  if (this.transaction !== null)
  {
    if( this.nextTransaction !== null) {
      throw new Error(
        'Sending too many requests to TunnelTransport. '
          + 'maxConcurrentRequests should be 2.'
      );
    }
    else {

      // save it for when we finish the current transaction
      this.nextTransaction = transaction;

      return;
    }
  }

  this.transaction = transaction;

  this.startTransaction();

};

/**
 * signal transaction start and init timeout
 *
 * @return {[type]} [description]
 */
TunnelTransport.prototype.startTransaction = function()
{
  if( this.transaction )
  {
    this.emit('request', this.transaction);

    this.transaction.start(this.handleTimeout);
  }
}

/**
 * Launches the response to the SLAVE_COMMAND function code
 *
 * @private
 * @param {Transaction} transaction
 * @throws {Error}
 */
TunnelTransport.prototype.sendSlaveResponse = function()
{

  var adu = this.getAdu(this.transaction);

  // set RTS line to active
  //this.connection.set( {rts: true} );

  this.connection.write(adu);

  // wait till all characters transmitted, then release RTS
  //this.connection.drain( function() {
  //  this.connection.set( {rts: false} );
  //});

};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
TunnelTransport.prototype.getAdu = function(transaction)
{
  var adu = null;

  if( transaction !== null )
  {
    adu = transaction.getAdu();
  }

  if (adu === null)
  {
    adu = this.buildAdu(transaction);
  }

  return adu;
};

/**
 * @private
 * @param {Transaction} transaction
 * @returns {Buffer}
 */
TunnelTransport.prototype.buildAdu = function(transaction)
{
  var adu;

  if( transaction !== null )
  {

    var request = transaction.getRequest();

    // put the slave command sequence number up front,
    // and use our slaveId as the unit id
    var pdu = new Buffer([SLAVE_COMMAND, this.sequence, transaction.getUnit()]);

    pdu = Buffer.concat([pdu, request.toBuffer()]);

    adu = this.frame(this.options.slaveId, pdu);

    transaction.setAdu(adu);
  }
  else
  {
    adu = this.frame( this.options.slaveId, new Buffer([SLAVE_COMMAND, this.sequence]));
  }
  return adu;
};

/**
 * @private
 * @param {number} unit
 * @param {Buffer} pdu
 * @returns {Buffer}
 */
TunnelTransport.prototype.frame = function(unit, pdu)
{
  var builder = new buffers.BufferBuilder();

  builder.pushByte(unit);
  builder.pushBuffer(pdu);
  builder.pushUInt16(this.crc16(unit, pdu), true);

  return builder.toBuffer();
};

/**
 * @private
 * @param {number} firstByte
 * @param {Buffer} buffer
 * @returns {number}
 */
TunnelTransport.prototype.crc16 = function(firstByte, buffer)
{
  var crc = 0xFFFF;
  var j;

  if (firstByte !== -1)
  {
    j = (crc ^ firstByte) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  for (var i = 0, l = buffer.length; i < l; ++i)
  {
    j = (crc ^ buffer[i]) & 0xFF;

    crc >>= 8;
    crc ^= CRC_TABLE[j];
  }

  return crc;
};

/**
 * @private
 */
TunnelTransport.prototype.handleTimeout = function()
{
  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.skipResponseData();
};

/**
 * @private
 */
TunnelTransport.prototype.flushReader = function()
{
  if (this.reader.length > 0)
  {
    this.reader.skip(this.reader.length);
  }

};

/**
 * @private
 */
TunnelTransport.prototype.skipResponseData = function()
{
  this.flushReader();

  // kill this transaction and start the next one if available
  this.transaction = this.nextTransaction;
  this.nextTransaction = null;
  this.startTransaction();
};

/**
 * Event handler for incoming data from the port
 *
 * Accumulates the data and kicks the timer.  Keep
 * doing this until there is a gap in the data
 * and the timer fires (handleFrameData).
 *
 * @private
 * @param {Buffer} data
 */
TunnelTransport.prototype.onData = function(data)
{
  this.reader.push(data);

  if (this.eofTimer !== null)
  {
    clearTimeout(this.eofTimer);
  }

  this.eofTimer = setTimeout(this.handleFrameData, this.options.eofTimeout);
};

/**
 * @private
 */
TunnelTransport.prototype.handleFrameData = function()
{

  if (this.reader.length < 4)
  {
    // we received a message that is too short to process.
    // we just ignore it, but signal an event in case anyone cares.
    this.emit( 'sniff', 'incomplete', this.reader.buffers[0] );

    this.flushReader();

    return;
  }

  // copy for event emitting before we process the data
  var rxBuffer = new Buffer(this.reader.length);
  this.reader.copy( rxBuffer );

  var unit = this.reader.shiftByte();
  var responseBuffer = this.reader.shiftBuffer(this.reader.length - 2);
  var checksum = this.reader.shiftUInt16(true);

  this.flushReader();

  var validationError = this.validate(
    transaction,
    unit,
    responseBuffer,
    checksum
  );

  if (validationError !== null)
  {
    // wrong checksum?  Ignore...
    this.emit( 'sniff', 'bad checksum',  rxBuffer );

    return;
  }


  // Emit the received message in case anybody cares about it.
  // This will include messages heard on the bus that are not
  // addressed to us, as well as those addressed to us.
  this.emit( 'sniff', 'pdu', rxBuffer );

  // Check the slave ID; on a multi-drop network
  // we might overhear messages intended for other
  // slaves.
  if (unit === this.options.slaveId)
  {

    // the message is for us
    // Check the sequence ID; if it matches our counter,
    // it is a response to the pending transaction
    if( responseBuffer[0] === SLAVE_COMMAND )
    {
      if( responseBuffer[1] === this.sequence )
      {
        //console.log('In-sequence SLAVE_COMMAND');

        // Remove the SLAVE_COMMAND function code and sequence, and
        // treat the rest of the buffer as the response to the transaction
        //
        // sequence byte is incremented to show we are ready to move on
        this.sequence = (this.sequence+1) & 255;

        // if there is a transaction in progress, close it out
        if( this.transaction !== null && responseBuffer.length > 2)
        {
          //console.log('Closing transaction');

          var transaction = this.transaction;
          this.transaction = this.nextTransaction;
          this.nextTransaction = null;

          var request = transaction.getRequest();

          try
          {
            transaction.handleResponse(request.createResponse(responseBuffer.slice(3)));
          }
          catch (error)
          {
            transaction.handleError(error);
          }

          // Start next transaction if any
          this.startTransaction();

        }
      }
      else
      {
        // sequence number is wrong.  Ignore the PDU-T, if any
        //console.log('Out-of-sequence SLAVE_COMMAND');

      }

      // Prepare and send our response to the SLAVE_COMMAND
      this.sendSlaveResponse();

    }
    else
    {
      // message to us, but not a SLAVE COMMAND
      // ignore, wait for a slave command to come
      console.log('Ignored incoming function code ' + responseBuffer[0] );
    }
  }
};

/**
 * Checks to see if we have received a valid MODBUS PDU
 *
 * @private
 * @param {Transaction} transaction
 * @param {number} actualUnit
 * @param {Buffer} responseBuffer
 * @param {number} expectedChecksum
 * @returns {Error|null}
 */
TunnelTransport.prototype.validate =
  function(transaction, actualUnit, responseBuffer, expectedChecksum)
{
  var actualChecksum = this.crc16(actualUnit, responseBuffer);

  if (actualChecksum !== expectedChecksum)
  {
    return new errors.InvalidChecksumError();
  }


  return null;
};

}).call(this,require("buffer").Buffer)
},{"../Transport":23,"../errors":30,"buffer":2,"h5.buffers":83,"util":10}],79:[function(require,module,exports){
(function (Buffer){
'use strict';

/**
 * A builder of dynamically sized `Buffer`s.
 *
 * @constructor
 * @property {number} length A number of pushed bytes.
 * @example
 * var builder = new BufferBuilder();
 *
 * builder
 *   .pushByte(0x01)
 *   .pushUInt16(12)
 *   .pushString('Hello World!');
 *
 * var buffer = builder.toBuffer();
 *
 * console.log(buffer);
 */
function BufferBuilder()
{
  /**
   * @type {number}
   */
  this.length = 0;

  /**
   * @private
   * @type {Array.<function(Buffer, number): number>}
   */
  this.data = [];
}

/**
 * Returns a new `Buffer` with all data pushed to this builder.
 *
 * The new `Buffer` will have the same length as the builder.
 *
 * @returns {Buffer} An instance of `Buffer` filled with all bytes pushed to
 * this builder.
 * @example
 * var buffer = builder.toBuffer();
 */
BufferBuilder.prototype.toBuffer = function()
{
  var buffer = new Buffer(this.length);

  this.data.reduce(function(offset, push)
  {
    return offset + push(buffer, offset);
  }, 0);

  return buffer;
};

/**
 * Appends the specified bits to this builder.
 *
 * A number of bytes corresponding to the following formula will be appended
 * to the builder:
 *
 *     var byteCount = Math.ceil(bitsArray.length / 8);
 *
 * If the number of bits is not a multiple of 8, then the remaining bits will
 * be set to `0`.
 *
 * Each 8 values from the array correspond to the 8 bits being appended to the
 * buffer as bytes. First value of the each octet is the least significant bit,
 * last value - the most significant bit.
 *
 * Truthy values become `1`'s and falsy values become `0`'s.
 *
 * For example, pushing the following array of 11 values:
 * ```
 *     [0, 1, 1, 0, 0, 1, 1, 1,
 *                     0, 1, 1]
 * ```
 * will result in 2 bytes being appended to the builder:
 * `0xE6`, because its bit representation is `11100110` and
 * `0x06`, because its bit representation is `00000011`.
 *
 * @param {Array.<boolean>} bitsArray An array of truthy and falsy values.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified argument is not an array.
 * @example
 * builder.pushBits([0, 0, 0, 0, 1, 1, 0, 1, 0, 1])
 * builder.pushBits((0xABCD).toString(2).split('').map(Number))
 */
BufferBuilder.prototype.pushBits = function(bitsArray)
{
  if (!Array.isArray(bitsArray))
  {
    throw new Error('Expected an array.');
  }

  var bitsCount = bitsArray.length;
  
  if (bitsCount === 0)
  {
    return this;
  }

  var byteCount = Math.ceil(bitsCount / 8);

  this.data.push(function(buffer, offset)
  {
    var bitIndex = 0;
    var byteValue = 0;

    for (var i = 0; i < bitsCount; ++i)
    {
      if (bitIndex !== 0 && bitIndex % 8 === 0)
      {
        buffer[offset++] = byteValue;

        bitIndex = 0;
        byteValue = bitsArray[i] ? 1 : 0;
      }
      else if (bitsArray[i])
      {
        byteValue |= Math.pow(2, bitIndex);
      }

      bitIndex += 1;
    }

    buffer[offset] = byteValue;

    return byteCount;
  });

  this.length += byteCount;

  return this;
};

/**
 * Appends the specified byte to this builder.
 *
 * Increases the length of the builder by 1.
 *
 * @param {number} byteValue A number between 0 and 255.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified argument is not a number between 0 and 255.
 * @example
 * builder.pushByte(0xFE);
 */
BufferBuilder.prototype.pushByte = function(byteValue)
{
  byteValue = parseInt(byteValue, 10);

  if (isNaN(byteValue) || byteValue < 0 || byteValue > 255)
  {
    throw new Error('Expected a number between 0 and 255.');
  }

  this.data.push(function(buffer, offset)
  {
    buffer[offset] = byteValue;

    return 1;
  });

  this.length += 1;

  return this;
};

/**
 * Appends the specified ASCII character to this builder.
 *
 * Increases the length of the builder by 1.
 *
 * @param {string} charValue An ASCII character.
 * @returns {BufferBuilder} Self.
 * @throws {ReferenceError} If no char value was specified.
 * @throws {TypeError} If the specified argument is not a string.
 * @throws {Error} If the specified argument is not an ASCII character.
 * @example
 * builder.pushChar('!');
 */
BufferBuilder.prototype.pushChar = function(charValue)
{
  var byteValue = charValue.charCodeAt(0);

  if (isNaN(byteValue) || byteValue < 0 || byteValue > 127)
  {
    throw new Error('Expected an ASCII character.');
  }

  return this.pushByte(byteValue);
};

/**
 * Appends the specified bytes to this builder.
 *
 * Increases the length of the builder by the length of the specified array.
 *
 * @param {Array.<number>} bytesArray An array of numbers between 0 and 255.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified argument is not an array.
 * @example
 * builder.pushBytes([0x00, 0x01, 0xAB, 0xCD]);
 */
BufferBuilder.prototype.pushBytes = function(bytesArray)
{
  if (!Array.isArray(bytesArray))
  {
    throw new Error('Expected an array.');
  }

  var bytesCount = bytesArray.length;

  if (bytesCount === 0)
  {
    return this;
  }

  this.data.push(function(buffer, offset)
  {
    for (var i = 0; i < bytesCount; ++i)
    {
      buffer[offset + i] = bytesArray[i];
    }

    return bytesCount;
  });

  this.length += bytesCount;

  return this;
};

/**
 * Appends bytes from the specified source `Buffer` to this builder.
 *
 * Increases the length of the builder by the specified source buffer.
 *
 * @param {Buffer} sourceBuffer An instance of `Buffer`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified argument is not an instance of `Buffer`.
 * @example
 * builder.pushBuffer(new Buffer([0, 1, 2]));
 * builder.pushBuffer(new Buffer('Hello!'));
 */
BufferBuilder.prototype.pushBuffer = function(sourceBuffer)
{
  if (!Buffer.isBuffer(sourceBuffer))
  {
    throw new Error('Expected an instance of Buffer.');
  }

  if (sourceBuffer.length === 0)
  {
    return this;
  }

  this.data.push(function(targetBuffer, offset)
  {
    return sourceBuffer.copy(targetBuffer, offset, 0, sourceBuffer.length);
  });

  this.length += sourceBuffer.length;

  return this;
};

/**
 * Appends the specified string in the specified encoding to this builder.
 *
 * Increases the length of the builder by the byte length of the specified
 * string. Byte length is calculated using `Buffer.byteLength()` function.
 *
 * @param {string} stringValue A string value in the specified encoding.
 * @param {string} [encoding] An encoding of the specified string value.
 * Defaults to `utf8`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a string.
 * @example
 * builder.pushString('Hęłłó!');
 * builder.pushString('Hello!', 'ascii');
 */
BufferBuilder.prototype.pushString = function(stringValue, encoding)
{
  if (typeof stringValue !== 'string')
  {
    throw new Error('Expected a string.');
  }

  if (stringValue.length === 0)
  {
    return this;
  }

  if (!encoding)
  {
    encoding = 'utf8';
  }

  this.data.push(function(buffer, offset)
  {
    return buffer.write(stringValue, offset, encoding);
  });

  this.length += Buffer.byteLength(stringValue, encoding);

  return this;
};

/**
 * Appends the specified string followed by NULL character (`\0`)
 * to this builder.
 *
 * Increases the length of the builder by the byte length of the specified
 * string value plus 1. Byte length is calculated using `Buffer.byteLength()`
 * function.
 *
 * @param {string} stringValue A string value in the specified encoding.
 * @param {string} [encoding] An encoding of the specified string value.
 * Defaults to `utf8`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a string.
 * @example
 * builder.pushZeroString('Hęłłó!');
 * builder.pushZeroString('Hello!', 'ascii');
 */
BufferBuilder.prototype.pushZeroString = function(stringValue, encoding)
{
  return this.pushString(stringValue, encoding).pushByte(0);
};

/**
 * Appends the specified number as a signed 8-bit integer to this builder.
 *
 * Increases the length of the builder by 1.
 *
 * @param {number} numberValue A number between -128 and 127.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not an 8-bit signed integer.
 * @example
 * builder.pushInt8(-100);
 * builder.pushInt8(10, true);
 */
BufferBuilder.prototype.pushInt8 = function(numberValue)
{
  numberValue = parseIntValue(numberValue, 0x7F, -0x80);

  this.data.push(function(buffer, offset)
  {
    buffer.writeInt8(numberValue, offset, true);

    return 1;
  });

  this.length += 1;

  return this;
};

/**
 * Appends the specified number as a signed 16-bit integer to this builder.
 *
 * Increases the length of the builder by 2.
 *
 * @param {number} numberValue A number between -32768 and 32767.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a 16-bit signed integer.
 * @example
 * builder.pushInt16(12345);
 * builder.pushInt16(-12345, true);
 */
BufferBuilder.prototype.pushInt16 = function(numberValue, littleEndian)
{
  numberValue = parseIntValue(numberValue, 0x7FFF, -0x8000);

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeInt16LE' : 'writeInt16BE'](
      numberValue, offset, true
    );

    return 2;
  });

  this.length += 2;

  return this;
};

/**
 * Appends the specified number as a signed 32-bit integer to this builder.
 *
 * Increases the length of the builder by 4.
 *
 * @param {number} numberValue A number between -2147483648 and 2147483647.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a 32-bit signed integer.
 * @example
 * builder.pushInt32(-123456789);
 * builder.pushInt32(123456789, true);
 */
BufferBuilder.prototype.pushInt32 = function(numberValue, littleEndian)
{
  numberValue = parseIntValue(numberValue, 0x7FFFFFFF, -0x80000000);

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeInt32LE' : 'writeInt32BE'](
      numberValue, offset, true
    );

    return 4;
  });

  this.length += 4;

  return this;
};

/**
 * Appends the specified number as an unsigned 8-bit integer to this builder.
 *
 * Increases the length of the builder by 1.
 *
 * @param {number} numberValue A number between 0 and 255.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not an 8-bit unsigned integer.
 * @example
 * builder.pushUInt8(255);
 * builder.pushUInt8(66, true);
 */
BufferBuilder.prototype.pushUInt8 = function(numberValue)
{
  numberValue = parseIntValue(numberValue, 0xFF, 0x00);

  this.data.push(function(buffer, offset)
  {
    buffer.writeUInt8(numberValue, offset, true);

    return 1;
  });

  this.length += 1;

  return this;
};

/**
 * Appends the specified number as an unsigned 16-bit integer to this builder.
 *
 * Increases the length of the builder by 2.
 *
 * @param {number} numberValue A number between 0 and 65535.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a 16-bit unsigned integer.
 * @example
 * builder.pushUInt16(256);
 * builder.pushUInt16(1, true);
 */
BufferBuilder.prototype.pushUInt16 = function(numberValue, littleEndian)
{
  numberValue = parseIntValue(numberValue, 0xFFFF, 0x0000);

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeUInt16LE' : 'writeUInt16BE'](
      numberValue, offset, true
    );

    return 2;
  });

  this.length += 2;

  return this;
};

/**
 * Appends the specified number as an unsigned 32-bit integer to this builder.
 *
 * Increases the length of the builder by 4.
 *
 * @param {number} numberValue A number between 0 and 4294967295.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a 32-bit unsigned integer.
 * @example
 * builder.pushUInt32(4000111222);
 * builder.pushUInt32(4000111222, true);
 */
BufferBuilder.prototype.pushUInt32 = function(numberValue, littleEndian)
{
  numberValue = parseIntValue(numberValue, 0xFFFFFFFF, 0x00000000);

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeUInt32LE' : 'writeUInt32BE'](
      numberValue, offset, true
    );

    return 4;
  });

  this.length += 4;

  return this;
};

/**
 * Appends the specified number as a signed 32 bit floating-point number
 * defined in IEEE 754.
 *
 * Increases the length of the builder by 4.
 *
 * @param {number} numberValue A number between -3.4028234663852886e+38
 * and 3.4028234663852886e+38.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a float.
 * @example
 * builder.pushFloat(123.456);
 * builder.pushFloat(-123.456);
 */
BufferBuilder.prototype.pushFloat = function(numberValue, littleEndian)
{
  numberValue = parseFloatValue(
    numberValue, 3.4028234663852886e+38, -3.4028234663852886e+38
  );

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeFloatLE' : 'writeFloatBE'](
      numberValue, offset, true
    );

    return 4;
  });

  this.length += 4;

  return this;
};

/**
 * Appends the specified number as a signed 64 bit floating-point number
 * defined in IEEE 754.
 *
 * Increases the length of the builder by 8.
 *
 * @param {number} numberValue A number between -1.7976931348623157e+308
 * and 1.7976931348623157e+308.
 * @param {boolean} [littleEndian] `TRUE` for little endian byte order;
 * `FALSE` for big endian. Defaults to `FALSE`.
 * @returns {BufferBuilder} Self.
 * @throws {Error} If the specified value is not a double.
 * @example
 * builder.pushDouble(12345.6789);
 * builder.pushDouble(-12345.99999);
 */
BufferBuilder.prototype.pushDouble = function(numberValue, littleEndian)
{
  numberValue = parseFloatValue(
    numberValue, 1.7976931348623157e+308, -1.7976931348623157e+308
  );

  this.data.push(function(buffer, offset)
  {
    buffer[littleEndian ? 'writeDoubleLE' : 'writeDoubleBE'](
      numberValue, offset, true
    );

    return 8;
  });

  this.length += 8;

  return this;
};

/**
 * @private
 * @param {number} value
 * @param {number} max
 * @param {number} min
 * @returns {number}
 * @throws {Error}
 */
function parseIntValue(value, max, min)
{
  value = parseInt(value, 10);

  if (isNaN(value) || value < min || value > max)
  {
    throw new Error('Expected an integer between ' + min + ' and ' + max + '.');
  }

  return value;
}

/**
 * @private
 * @param {number} value
 * @param {number} max
 * @param {number} min
 * @returns {number}
 * @throws {Error}
 */
function parseFloatValue(value, max, min)
{
  value = parseFloat(value, 10);

  if (isNaN(value) || value < min || value > max)
  {
    throw new Error(
      'Expected a floating-point number between ' + min + ' and ' + max + '.'
    );
  }

  return value;
}

module.exports = BufferBuilder;

}).call(this,require("buffer").Buffer)
},{"buffer":2}],80:[function(require,module,exports){
(function (Buffer){
'use strict';

var toBits = require('./helpers').toBits;

/**
 * A class providing extended functionality for reading lists/streams of
 * `Buffer` instances.
 *
 * @constructor
 * @param {...Buffer} [bufferN] An optional buffer to push.
 * @throws {Error} If any of the specified buffers aren't instances of `Buffer`.
 * @property {number} length The remaining length of the reader.
 * @example
 * var reader = new BufferQueueReader(new Buffer(3), new Buffer(8));
 *
 * reader.push(new Buffer(10));
 * reader.push(new Buffer(5));
 * reader.push(new Buffer(16));
 *
 * console.log('int16=', reader.shiftInt16());
 * console.log('uint32=', reader.shiftUInt32());
 * console.log('bits=', reader.readBits(0, 12));
 *
 * reader.skip(2);
 *
 * console.log('double=', reader.shiftDouble());
 */
function BufferQueueReader()
{
  /**
   * @type {number}
   */
  this.length = 0;

  /**
   * @private
   * @type {number}
   */
  this.offset = 0;

  /**
   * @private
   * @type {Array.<Buffer>}
   */
  this.buffers = [];
  
  for (var i = 0, l = arguments.length; i < l; ++i)
  {
    this.push(arguments[i]);
  }
}

/**
 * Adds the specified buffers to the reader.
 *
 * Empty buffers are ignored.
 *
 * @param {...Buffer} bufferN An optional buffer to push.
 * @throws {Error} If any of the specified buffers aren't an instance
 * of `Buffer`.
 * @example
 * reader.push(new Buffer('Hello'), new Buffer(' '), new Buffer('World!'));
 */
BufferQueueReader.prototype.push = function()
{
  for (var i = 0, l = arguments.length; i < l; ++i)
  {
    var buffer = arguments[i];
    
    if (!Buffer.isBuffer(buffer))
    {
      throw new Error("The buffer must be an instance of Buffer.");
    }
    
    if (buffer.length === 0)
    {
      continue;
    }
    
    this.buffers.push(buffer);
    
    this.length += buffer.length;
  }
};

/**
 * Skips the specified number of bytes.
 *
 * If the byte count was not specified or it's value is greater than the length
 * of the reader, skips all the bytes to the end.
 *
 * @param {number} [count] A number of bytes to skip.
 * Defaults to the reader's length.
 * @throws {Error} If the count is not a number greater than or equal to 0.
 * @example
 * reader.skip(10);
 */
BufferQueueReader.prototype.skip = function(count)
{
  count = arguments.length ? parseInt(count, 10) : this.length;

  if (isNaN(count) || count < 0)
  {
    throw new Error(
      "The byte count must be a number greater than or equal to 0."
    );
  }

  if (count > this.length)
  {
    count = this.length;
  }
  
  this.offset += count;
  this.length -= count;
  
  var buffer;
  
  while (this.buffers.length > 0
    && (buffer = this.buffers[0]).length <= this.offset)
  {
    this.buffers.shift();
    
    this.offset -= buffer.length;
  }
};

/**
 * Returns a position of the next occurence of the specified byte after
 * the specified starting index.
 *
 * @param {number} searchElement A byte value to search for.
 * @param {number} [fromIndex] A starting index. Defaults to 0 (the beginning).
 * @returns {number} A position of the found element (starting at 0)
 * or -1 if the search element was not found.
 * @throws {Error} If the search element is not a number between 0x00 and 0xFF.
 * @throws {Error} If the starting index is not a number between 0
 * and the reader's length.
 * @example
 * var index = reader.indexOf(0xFF, 20);
 */
BufferQueueReader.prototype.indexOf = function(searchElement, fromIndex)
{
  /*jshint maxstatements:22*/

  searchElement = parseInt(searchElement, 10);

  if (isNaN(searchElement) || searchElement < 0x00 || searchElement > 0xFF)
  {
    throw new Error(
      "The search element must be a number between 0x00 and 0xFF."
    );
  }

  fromIndex = arguments.length >= 2 ? parseInt(fromIndex, 10) : 0;

  if (isNaN(fromIndex) || fromIndex < 0 || fromIndex > this.length)
  {
    throw new Error(
      "The search starting index must be a number between 0 "
      + "and the reader's length."
    );
  }
  
  var offset = this.offset + fromIndex;
  var index = 0;
  var buffer = this.buffers[index];
  
  while (index < this.buffers.length && offset >= buffer.length)
  {
    offset -= buffer.length;
    buffer = this.buffers[++index];
  }

  var totalOffset = fromIndex;
  
  while (index < this.buffers.length)
  {
    if (buffer[offset] === searchElement)
    {
      return totalOffset;
    }
    
    offset += 1;
    totalOffset += 1;
    
    if (offset >= buffer.length)
    {
      offset = 0;
      buffer = this.buffers[++index];
    }
  }
  
  return -1;
};

/**
 * Copies bytes from the reader to the specified target buffer.
 *
 * @param {Buffer} targetBuffer A buffer to copy to.
 * @param {number} [targetStart] A position at which writing to the buffer
 * should begin. Defaults to 0 (the beginning).
 * @param {number} [sourceStart] A position from which writing from the reader
 * should begin. Defaults to 0 (the beginning).
 * @param {number} [sourceEnd] A position at which writing from
 * the reader should end. Defaults to the end (the reader's length).
 * @returns {number} A number of bytes written.
 * @throws {Error} If the specified target buffer is not an instance of Buffer.
 * @throws {Error} If the specified target start index is not a number between
 * 0 and the target buffer's length.
 * @throws {Error} If the specified source start index is not a number between
 * 0 and the reader's length (exclusive).
 * @throws {Error} If the specified source end index is not a number between
 * 0 (exclusive) and the reader's length.
 * @throws {Error} If the specified source start index is greater than
 * or equal to the source end index.
 * @example
 * var buffer = new Buffer(10);
 *
 * reader.copy(buffer, 5, 0, 5);
 */
BufferQueueReader.prototype.copy = function(
  targetBuffer, targetStart, sourceStart, sourceEnd)
{
  /*jshint maxstatements:32*/

  if (!Buffer.isBuffer(targetBuffer))
  {
    throw new Error("The target buffer must be an instance of Buffer.");
  }

  targetStart = arguments.length >= 2 ? parseInt(targetStart, 10) : 0;

  if (isNaN(targetStart)
    || targetStart < 0
    || targetStart > targetBuffer.length)
  {
    throw new Error(
      "The target starting index must be a number greater than or "
      + "equal to 0 and less than or equal to the target buffer's length."
    );
  }

  sourceStart = arguments.length >= 3 ? parseInt(sourceStart, 10) : 0;

  if (isNaN(sourceStart) || sourceStart < 0 || sourceStart >= this.length)
  {
    throw new Error(
      "The source starting index must be a number greater than or "
      + "equal to 0 and less than the reader's length."
    );
  }

  sourceEnd = arguments.length >= 4 ? parseInt(sourceEnd, 10) : this.length;

  if (isNaN(sourceEnd) || sourceEnd < 1 || sourceEnd > this.length)
  {
    throw new Error(
      "The source ending index must be a number greater than 0 and "
      + "less than or equal to the reader's length."
    );
  }

  if (sourceStart >= sourceEnd)
  {
    throw new Error(
      "The source start index must be less than the source end index."
    );
  }

  var offset = this.offset + sourceStart;
  var index = 0;
  var buffer;

  while ((buffer = this.buffers[index++]).length <= offset)
  {
    offset -= buffer.length;
  }

  var count = sourceEnd - sourceStart;

  if (buffer.length >= offset + count)
  {
    return buffer.copy(targetBuffer, targetStart, offset, offset + count);
  }

  var totalWritten = 0;

  while (count)
  {
    var written = buffer.copy(
      targetBuffer, targetStart, offset, Math.min(buffer.length, offset + count)
    );

    targetStart += written;
    totalWritten += written;
    count -= written;
    offset += written;

    if (offset >= buffer.length)
    {
      offset = 0;
      buffer = this.buffers[index++];
    }
  }

  return totalWritten;
};

/**
 * Shifts an array of bits (boolean values) from the reader.
 *
 * Decreases the reader's length by a number of bytes that is needed to
 * extract the specified number of bits
 * (e.g. 4, 8 bits=1 byte, 9, 13, 16 bits=2 bytes etc.).
 *
 * @param {number} count A number of bits to shift.
 * Must be between 1 and the reader's length multiplied by 8.
 * @returns {Array.<boolean>} An array of bits.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length multiplied by 8.
 * @example
 * var bitsArray = reader.shiftBits(13);
 */
BufferQueueReader.prototype.shiftBits = function(count)
{
  return toBits(this.shiftBytes(Math.ceil(count / 8)), count);
};

/**
 * Shifts a byte from the reader.
 *
 * Decreases the reader's length by 1.
 *
 * @returns {number} A number between 0x00 and 0xFF.
 * @throws {Error} If the reader is empty.
 * @example
 * var byteValue = reader.shiftByte();
 */
BufferQueueReader.prototype.shiftByte = function()
{
  if (this.length === 0)
  {
    throw new Error("The reader is empty.");
  }

  var buffer = this.buffers[0];
  var byteValue = buffer[this.offset++];

  this.length -= 1;

  if (this.offset >= buffer.length)
  {
    this.buffers.shift();

    this.offset -= buffer.length;
  }

  return byteValue;
};

/**
 * Shifts an ASCII character from the reader.
 *
 * Decreases the reader's length by 1.
 *
 * @returns {string} An ASCII character.
 * @throws {Error} If the reader is empty.
 * @example
 * var charValue = reader.shiftChar();
 */
BufferQueueReader.prototype.shiftChar = function()
{
  return String.fromCharCode(this.shiftByte());
};

/**
 * Shifts the specified number of bytes from the reader.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} count A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @returns {Array.<number>} An array of bytes.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length.
 * @example
 * var bytesArray = reader.shiftBytes(6);
 */
BufferQueueReader.prototype.shiftBytes = function(count)
{
  count = parseInt(count, 10);

  if (isNaN(count) || count < 1 || count > this.length)
  {
    throw new Error(
      "The byte count must be a number greater than 0 and "
      + "less than or equal to the reader's length."
    );
  }

  this.length -= count;

  var byteArray = [];

  while (count--)
  {
    var buffer = this.buffers[0];

    byteArray.push(buffer[this.offset++]);

    if (this.offset >= buffer.length)
    {
      this.buffers.shift();

      this.offset -= buffer.length;
    }
  }

  return byteArray;
};

/**
 * Shifts the specified number of bytes as an instance of Buffer.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} count A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @returns {Buffer} A buffer of the specified size.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length.
 * @example
 * var buffer = reader.shiftBuffer(10);
 */
BufferQueueReader.prototype.shiftBuffer = function(count)
{
  return new Buffer(this.shiftBytes(count));
};

/**
 * Shifts the specified number of bytes as a string with
 * the specified encoding.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} length A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string of the specified length.
 * @throws {Error} If the specified length is not a number between 1 and
 * the reader's length.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.shiftString(12, 'ascii');
 */
BufferQueueReader.prototype.shiftString = function(length, encoding)
{
  return this.shiftBuffer(length).toString(encoding || 'utf8');
};

/**
 * Shifts a string from the beginning of the reader until the first
 * occurence of the NULL character (\0).
 *
 * Decreases the reader's length by the returned string's length plus one.
 *
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string constructed from the shifted bytes or empty string
 * if NULL character could not be found.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.shiftZeroString('utf8');
 */
BufferQueueReader.prototype.shiftZeroString = function(encoding)
{
  var zeroIndex = this.indexOf(0);

  if (zeroIndex === -1)
  {
    return '';
  }

  var zeroString = this.shiftString(zeroIndex, encoding);

  this.skip(1);

  return zeroString;
};

/**
 * Shifts a signed 8 bit integer.
 *
 * Decreases the reader's length by one byte.
 *
 * @returns {number} A number between -128 and 127.
 * @throws {Error} If the reader is empty.
 * @example
 * var int8 = reader.shiftInt8();
 */
BufferQueueReader.prototype.shiftInt8 = function()
{
  return toInt8(this.shiftByte());
};

/**
 * Shifts a signed 16 bit integer.
 *
 * Decreases the reader's length by two bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -32768 and 32767.
 * @throws {Error} If the reader's length is less than 2.
 * @example
 * var int16BE = reader.shiftInt16();
 * var int16LE = reader.shiftInt16(true);
 */
BufferQueueReader.prototype.shiftInt16 = function(littleEndian)
{
  return toInt16(shiftUInt(this, 2, littleEndian));
};

/**
 * Shifts a signed 32 bit integer.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -2147483648 and 2147483647.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var int32BE = reader.shiftInt32();
 * var int32LE = reader.shiftInt32(true);
 */
BufferQueueReader.prototype.shiftInt32 = function(littleEndian)
{
  return toInt32(shiftUInt(this, 4, littleEndian));
};

/**
 * Shifts an unsigned 8 bit integer.
 *
 * Decreases the reader's length by one byte.
 *
 * @returns {number} A number between 0 and 255.
 * @throws {Error} If the reader is empty.
 * @example
 * var uint8 = reader.shiftUInt8();
 */
BufferQueueReader.prototype.shiftUInt8 = function()
{
  return this.shiftByte();
};

/**
 * Shifts an unsigned 16 bit integer.
 *
 * Decreases the reader's length by two bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 65535.
 * @throws {Error} If the reader's length is less than 2.
 * @example
 * var uint16BE = reader.shiftUInt16();
 * var uint16LE = reader.shiftUInt16(true);
 */
BufferQueueReader.prototype.shiftUInt16 = function(littleEndian)
{
  return shiftUInt(this, 2, littleEndian);
};

/**
 * Shifts an unsigned 32 bit integer.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 4294967295.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var uint32BE = reader.shiftUInt32();
 * var uint32LE = reader.shiftUInt32(true);
 */
BufferQueueReader.prototype.shiftUInt32 = function(littleEndian)
{
  return shiftUInt(this, 4, littleEndian);
};

/**
 * Shifts a signed 32 bit floating-point number as defined in IEEE 754.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A 32 bit floating-point number.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var floatBE = reader.shiftFloat();
 * var floatLE = reader.shiftFloat(true);
 */
BufferQueueReader.prototype.shiftFloat = function(littleEndian)
{
  var readFloat = littleEndian ? 'readFloatLE' : 'readFloatBE';

  return this.shiftBuffer(4)[readFloat](0, false);
};

/**
 * Shifts a signed 64 bit floating-point number as defined in IEEE 754.
 *
 * Decreases the reader's length by eight bytes.
 *
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A 64 bit floating-point number.
 * @throws {Error} If the reader's length is less than 8.
 * @example
 * var doubleBE = reader.shiftDouble();
 * var doubleLE = reader.shiftDouble(true);
 */
BufferQueueReader.prototype.shiftDouble = function(littleEndian)
{
  var readDouble = littleEndian ? 'readDoubleLE' : 'readDoubleBE';

  return this.shiftBuffer(8)[readDouble](0, false);
};

/**
 * Returns an array of bits (boolean values) starting at the specified offset.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @param {number} count A number of bits to read. Must be between 1 and
 * the reader's length multiplied by 8 minus the starting index.
 * @returns {Array.<boolean>} An array of bits.
 * @throws {Error} If the specified count is not a number between 1 and the
 * reader's length multiplied by 8 minus the starting index.
 * @example
 * var bitsArray = reader.readBits(5, 13);
 */
BufferQueueReader.prototype.readBits = function(offset, count)
{
  return toBits(this.readBytes(offset, Math.ceil(count / 8)), count);
};

/**
 * Returns a byte at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {number} A number between 0x00 and 0xFF.
 * @throws {Error} If the reader is empty.
 * @example
 * var byteValue = reader.readByte(1);
 */
BufferQueueReader.prototype.readByte = function(offset)
{
  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0 || offset >= this.length)
  {
    throw new Error(
      "The offset must be a number between 0 and the reader's length minus one."
    );
  }

  offset += this.offset;

  var index = 0;
  var buffer;

  while ((buffer = this.buffers[index++]).length <= offset)
  {
    offset -= buffer.length;
  }

  return buffer[offset];
};

/**
 * Returns an ASCII character at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {string} An ASCII character.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var charValue = reader.readChar(4);
 */
BufferQueueReader.prototype.readChar = function(offset)
{
  return String.fromCharCode(this.readByte(offset));
};

/**
 * Returns the specified number of bytes starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified count.
 * @param {number} count A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @returns {Array.<number>} An array of bytes.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length minus the offset.
 * @example
 * var bytesArray = reader.readBytes(0, 6);
 */
BufferQueueReader.prototype.readBytes = function(offset, count)
{
  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0)
  {
    throw new Error("The offset must be a number greater than 0.");
  }

  count = parseInt(count, 10);

  if (isNaN(count) || count < 1)
  {
    throw new Error("The byte count must be a number greater than 0.");
  }

  if (offset + count > this.length)
  {
    throw new Error(
      "A sum of the offset and byte count must be less than or "
      + "equal to the reader's length"
    );
  }

  offset += this.offset;

  var byteArray = [];
  var index = 0;
  var buffer;

  while ((buffer = this.buffers[index++]).length <= offset)
  {
    offset -= buffer.length;
  }

  while (count--)
  {
    byteArray.push(buffer[offset++]);
      
    if (offset >= buffer.length)
    {
      offset = 0;
      buffer = this.buffers[index++];
    }
  }

  return byteArray;
};

/**
 * Returns the specified number of bytes as an instance of Buffer
 * starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified count.
 * @param {number} count A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @returns {Buffer} A Buffer of bytes.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length minus the offset.
 * @example
 * var buffer = reader.readBuffer(5, 10);
 */
BufferQueueReader.prototype.readBuffer = function(offset, count)
{
  /*jshint maxstatements:26*/

  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0)
  {
    throw new Error("The offset must be a number greater than 0.");
  }

  count = parseInt(count, 10);

  if (isNaN(count) || count < 1)
  {
    throw new Error("The byte count must be a number greater than 0.");
  }

  if (offset + count > this.length)
  {
    throw new Error(
      "A sum of the offset and byte count must be less than or "
      + "equal to the reader's length"
    );
  }

  offset += this.offset;

  var index = 0;
  var buffer;

  while ((buffer = this.buffers[index++]).length <= offset)
  {
    offset -= buffer.length;
  }

  if (buffer.length >= offset + count)
  {
    return buffer.slice(offset, offset + count);
  }

  var resultBuffer = new Buffer(count);
  var resultOffset = 0;

  while (count)
  {
    var written = buffer.copy(
      resultBuffer,
      resultOffset,
      offset,
      Math.min(buffer.length, offset + count)
    );

    resultOffset += written;
    count -= written;
    offset += written;

    if (offset >= buffer.length)
    {
      offset = 0;
      buffer = this.buffers[index++];
    }
  }

  return resultBuffer;
};

/**
 * Returns the specified number of bytes as a string with
 * the specified encoding.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified length.
 * @param {number} length A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string of the specified length.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified length is not a number between 1 and
 * the reader's length.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.readString(1, 12, 'ascii');
 */
BufferQueueReader.prototype.readString = function(offset, length, encoding)
{
  return this.readBuffer(offset, length).toString(encoding || 'utf8');
};

/**
 * Returns a string from the specified offset until the first
 * occurence of the NULL character (\0).
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string constructed from the read bytes or empty string if
 * NULL character could not be found.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.readZeroString(0, 'utf8');
 */
BufferQueueReader.prototype.readZeroString = function(offset, encoding)
{
  var zeroIndex = this.indexOf(0, offset);

  if (zeroIndex === -1 || zeroIndex - offset === 0)
  {
    return '';
  }

  return this.readString(offset, zeroIndex - offset, encoding);
};

/**
 * Returns a signed 8 bit integer at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {number} A number between -128 and 127.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the reader is empty.
 * @example
 * var int8 = reader.readInt8(5);
 */
BufferQueueReader.prototype.readInt8 = function(offset)
{
  return toInt8(this.readByte(offset));
};

/**
 * Returns a signed 16 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 2.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -32768 and 32767.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var int16BE = reader.readInt16(0);
 * var int16LE = reader.readInt16(2, true);
 */
BufferQueueReader.prototype.readInt16 = function(offset, littleEndian)
{
  return toInt16(readUInt(this, offset, 2, littleEndian));
};

/**
 * Returns a signed 32 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -2147483648 and 2147483647.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var int32BE = reader.readInt32(0);
 * var int32LE = reader.readInt32(4, true);
 */
BufferQueueReader.prototype.readInt32 = function(offset, littleEndian)
{
  return toInt32(readUInt(this, offset, 4, littleEndian));
};

/**
 * Returns an unsigned 8 bit integer at the specified position.
 *
 * @param {number} offset A starting index. Must be between 0 and
 * the reader's length minus 1.
 * @returns {number} A number between 0 and 255.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint8 = reader.readUInt8(0);
 */
BufferQueueReader.prototype.readUInt8 = function(offset)
{
  return this.readByte(offset);
};

/**
 * Returns an unsigned 16 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 2.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 65535.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint16BE = reader.readUInt16(0);
 * var uint16LE = reader.readUInt16(2, true);
 */
BufferQueueReader.prototype.readUInt16 = function(offset, littleEndian)
{
  return readUInt(this, offset, 2, littleEndian);
};

/**
 * Returns an unsigned 32 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 4294967295.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint32BE = reader.readUInt32(0);
 * var uint32LE = reader.readUInt32(4, true);
 */
BufferQueueReader.prototype.readUInt32 = function(offset, littleEndian)
{
  return readUInt(this, offset, 4, littleEndian);
};

/**
 * Returns a signed 32 bit floating-point number as defined in IEEE 754.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A 32 bit floating-point number.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var floatBE = reader.readFloat(0);
 * var floatLE = reader.readFloat(4, true);
 */
BufferQueueReader.prototype.readFloat = function(offset, littleEndian)
{
  var readFloat = littleEndian ? 'readFloatLE' : 'readFloatBE';

  return this.readBuffer(offset, 4)[readFloat](0, false);
};

/**
 * Returns a signed 64 bit floating-point number as defined in IEEE 754.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 8.
 * @param {boolean} littleEndian Whether to use little endian
 * instead of big endian.
 * @returns {number} A 64 bit floating-point number.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var doubleBE = reader.readDouble(0);
 * var doubleLE = reader.readDouble(8, true);
 */
BufferQueueReader.prototype.readDouble = function(offset, littleEndian)
{
  var readDouble = littleEndian ? 'readDoubleLE' : 'readDoubleBE';

  return this.readBuffer(offset, 8)[readDouble](0, false);
};

/**
 * @private
 * @param {BufferQueueReader} reader
 * @param {number} size
 * @param {boolean} littleEndian
 * @returns {number}
 */
function shiftUInt(reader, size, littleEndian)
{
  if (reader.length < size)
  {
    throw new Error("The reader's length is less than " + size + " bytes.");
  }

  reader.length -= size;

  var value = 0;
  var shift = -8;

  while (size--)
  {
    var buffer = reader.buffers[0];

    if (littleEndian)
    {
      value += ((buffer[reader.offset++] << (shift += 8)) >>> 0);
    }
    else
    {
      value = ((value << 8) >>> 0) + buffer[reader.offset++];
    }

    if (reader.offset >= buffer.length)
    {
      reader.offset -= reader.buffers.shift().length;
    }
  }

  return value;
}

/**
 * @private
 * @param {BufferQueueReader} reader
 * @param {number} offset
 * @param {number} size
 * @param {boolean} littleEndian
 * @returns {number}
 * @throws {Error}
 */
function readUInt(reader, offset, size, littleEndian)
{
  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0 || offset + size > reader.length)
  {
    throw new Error(
      "The offset must be a number between 0 and the reader's length minus 2."
    );
  }

  offset += reader.offset;

  var index = 0;
  var buffer;

  while ((buffer = reader.buffers[index++]).length <= offset)
  {
    offset -= buffer.length;
  }

  var value = 0;
  var shift = -8;

  while (size--)
  {
    if (littleEndian)
    {
      value += ((buffer[offset++] << (shift += 8)) >>> 0);
    }
    else
    {
      value = ((value << 8) >>> 0) + buffer[offset++];
    }

    if (offset >= buffer.length)
    {
      offset = 0;
      buffer = reader.buffers[index++];
    }
  }

  return value;
}

/**
 * @private
 * @param {number} uInt8
 * @returns {number}
 */
function toInt8(uInt8)
{
  return uInt8 & 0x80 ? (0x100 - uInt8) * -1 : uInt8;
}

/**
 * @private
 * @param {number} uInt16
 * @returns {number}
 */
function toInt16(uInt16)
{
  return uInt16 & 0x8000 ? (0x10000 - uInt16) * -1 : uInt16;
}

/**
 * @private
 * @param {number} uInt32
 * @returns {number}
 */
function toInt32(uInt32)
{
  return uInt32 & 0x80000000 ? (0x100000000 - uInt32) * -1 : uInt32;
}

module.exports = BufferQueueReader;

}).call(this,require("buffer").Buffer)
},{"./helpers":82,"buffer":2}],81:[function(require,module,exports){
(function (Buffer){
'use strict';

var toBits = require('./helpers').toBits;

/**
 * A class providing extended functionality for reading `Buffer` instances.
 *
 * @constructor
 * @param {Buffer} buffer A buffer to wrap.
 * @throws {Error} If the specified `buffer` is not a `Buffer`.
 * @property {number} length The remaining length of the reader.
 * @example
 * var buffer = new Buffer(256);
 * var reader = new BufferReader(buffer);
 *
 * console.log('int16=', reader.shiftInt16());
 * console.log('uint32=', reader.shiftUInt32());
 * console.log('bits=', reader.readBits(0, 12));
 *
 * reader.skip(2);
 *
 * console.log('double=', reader.shiftDouble());
 */
function BufferReader(buffer)
{
  if (!Buffer.isBuffer(buffer))
  {
    throw new Error("Buffer reader expects an instance of Buffer.");
  }

  /**
   * @type {number}
   */
  this.length = buffer.length;

  /**
   * @private
   * @type {number}
   */
  this.offset = 0;

  /**
   * @private
   * @type {Buffer}
   */
  this.buffer = buffer;
}

/**
 * Skips the specified number of bytes.
 *
 * If the byte count was not specified or it's value is greater than the length
 * of the reader, skips all the bytes to the end.
 *
 * @param {number} [count] A number of bytes to skip.
 * Defaults to the reader's length.
 * @throws {Error} If the count is not a number greater than or equal to 0.
 * @example
 * reader.skip(10);
 */
BufferReader.prototype.skip = function(count)
{
  count = arguments.length === 0 ? this.length : parseInt(count, 10);

  if (isNaN(count) || count < 0)
  {
    throw new Error(
      "The byte count must be a number greater than or equal to 0."
    );
  }

  if (count > this.length)
  {
    count = this.length;
  }

  this.offset += count;
  this.length -= count;
};

/**
 * Returns a position of the next occurence of the specified byte after
 * the specified starting index.
 *
 * @param {number} searchElement A byte value to search for.
 * @param {number=0} fromIndex A starting index. Defaults to 0 (the beginning).
 * @returns {number} A position of the found element (starting at 0) or
 * -1 if the search element was not found.
 * @throws {Error} If the search element is not a number between 0x00 and 0xFF.
 * @throws {Error} If the starting index is not a number between 0 and
 * the reader's length.
 * @example
 * var index = reader.indexOf(0xAB, 10);
 */
BufferReader.prototype.indexOf = function(searchElement, fromIndex)
{
  searchElement = parseInt(searchElement, 10);

  if (isNaN(searchElement) || searchElement < 0x00 || searchElement > 0xFF)
  {
    throw new Error(
      "The search element must be a number between 0x00 and 0xFF."
    );
  }

  fromIndex = arguments.length >= 2 ? parseInt(fromIndex, 10) : 0;

  if (isNaN(fromIndex) || fromIndex < 0 || fromIndex > this.length)
  {
    throw new Error(
      "The search starting index must be a number " +
      "between 0 and the reader's length."
    );
  }

  for (var i = this.offset + fromIndex; i < this.length; ++i)
  {
    if (this.buffer[i] === searchElement)
    {
      return i - this.offset;
    }
  }

  return -1;
};

/**
 * Copies bytes from the reader to the specified target buffer.
 *
 * @param {Buffer} targetBuffer A buffer to copy to.
 * @param {number=0} targetStart A position at which writing to the buffer
 * should begin. Defaults to 0 (the beginning).
 * @param {number=0} sourceStart A position from which writing from the reader
 * should begin. Defaults to 0 (the beginning).
 * @param {number=this.length} sourceEnd A position at which writing from
 * the reader should end. Defaults to the end (the reader's length).
 * @returns {number} A number of bytes written.
 * @throws {Error} If the specified target buffer is not an instance of Buffer.
 * @throws {Error} If the specified target start index is not a number between
 * 0 and the target buffer's length.
 * @throws {Error} If the specified source start index is not a number between
 * 0 and the reader's length (exclusive).
 * @throws {Error} If the specified source end index is not a number between
 * 0 (exclusive) and the reader's length.
 * @throws {Error} If the specified source start index is greater than or
 * equal to the source end index.
 * @example
 * var buffer = new Buffer(10);
 *
 * reader.copy(buffer, 0);
 * reader.copy(buffer, 5, 4, 9);
 */
BufferReader.prototype.copy = function(
  targetBuffer, targetStart, sourceStart, sourceEnd)
{
  if (!Buffer.isBuffer(targetBuffer))
  {
    throw new Error("The target buffer must be an instance of Buffer.");
  }

  targetStart = arguments.length >= 2 ? parseInt(targetStart, 10) : 0;

  if (isNaN(targetStart)
    || targetStart < 0
    || targetStart > targetBuffer.length)
  {
    throw new Error(
      "The target starting index must be a number greater than " +
      "or equal to 0 and less than or equal to the target buffer's length."
    );
  }

  sourceStart = arguments.length >= 3 ? parseInt(sourceStart, 10) : 0;

  if (isNaN(sourceStart) || sourceStart < 0 || sourceStart >= this.length)
  {
    throw new Error(
      "The source starting index must be a number greater than " +
      "or equal to 0 and less than the reader's length."
    );
  }

  sourceEnd = arguments.length >= 4 ? parseInt(sourceEnd, 10) : this.length;

  if (isNaN(sourceEnd) || sourceEnd < 1 || sourceEnd > this.length)
  {
    throw new Error(
      "The source ending index must be a number greater than 0 " +
      "and less than or equal to the reader's length."
    );
  }

  if (sourceStart >= sourceEnd)
  {
    throw new Error(
      "The source start index must be less than the source end index."
    );
  }

  return this.buffer.copy(
    targetBuffer,
    targetStart,
    this.offset + sourceStart,
    this.offset + sourceEnd
  );
};

/**
 * Shifts an array of bits (boolean values) from the reader.
 *
 * Decreases the reader's length by a number of bytes that is needed to
 * extract the specified number of bits
 * (e.g. 4, 8 bits=1 byte, 9, 13, 16 bits=2 bytes etc.).
 *
 * @param {number} count A number of bits to shift.
 * Must be between 1 and the reader's length multiplied by 8.
 * @returns {Array.<boolean>} An array of bits.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length multiplied by 8.
 * @example
 * var bitsArray = reader.shiftBits(13);
 */
BufferReader.prototype.shiftBits = function(count)
{
  return toBits(this.shiftBytes(Math.ceil(count / 8)), count);
};

/**
 * Shifts a byte from the reader.
 *
 * Decreases the reader's length by 1.
 *
 * @returns {number} A number between 0x00 and 0xFF.
 * @throws {Error} If the reader is empty.
 * @example
 * var byteValue = reader.shiftByte();
 */
BufferReader.prototype.shiftByte = function()
{
  if (this.length === 0)
  {
    throw new Error("The reader is empty.");
  }

  this.length -= 1;

  return this.buffer[this.offset++];
};

/**
 * Shifts an ASCII character from the reader.
 *
 * Decreases the reader's length by 1.
 *
 * @returns {string} An ASCII character.
 * @throws {Error} If the reader is empty.
 * @example
 * var charValue = reader.shiftChar();
 */
BufferReader.prototype.shiftChar = function()
{
  return String.fromCharCode(this.shiftByte());
};

/**
 * Shifts the specified number of bytes from the reader.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} count A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @returns {Array.<number>} An array of bytes.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length.
 * @example
 * var bytesArray = reader.shiftBytes(6);
 */
BufferReader.prototype.shiftBytes = function(count)
{
  count = parseInt(count, 10);

  if (isNaN(count) || count < 1 || count > this.length)
  {
    throw new Error(
      "The byte count must be a number greater than 0 " +
      "and less than or equal to the reader's length."
    );
  }
  
  this.length -= count;

  var byteArray = [];

  while (count--)
  {
    byteArray.push(this.buffer[this.offset++]);
  }

  return byteArray;
};

/**
 * Shifts the specified number of bytes as an instance of Buffer.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} count A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @returns {Buffer} A buffer of the specified size.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length.
 * @example
 * var buffer = reader.shiftBuffer(10);
 */
BufferReader.prototype.shiftBuffer = function(count)
{
  return new Buffer(this.shiftBytes(count));
};

/**
 * Shifts the specified number of bytes as a string with
 * the specified encoding.
 *
 * Decreases the reader's length by the specified byte count.
 *
 * @param {number} length A number of bytes to shift.
 * Must be between 1 and the reader's length.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string of the specified length.
 * @throws {Error} If the specified length is not a number between 1 and
 * the reader's length.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.shiftString(12, 'ascii');
 */
BufferReader.prototype.shiftString = function(length, encoding)
{
  return this.shiftBuffer(length).toString(encoding || 'utf8');
};

/**
 * Shifts a string from the beginning of the reader until the first
 * occurence of the NULL character (\0).
 *
 * Decreases the reader's length by the returned string's length plus one.
 *
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string constructed from the shifted bytes or empty string
 * if NULL character could not be found.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.shiftZeroString('utf8');
 */
BufferReader.prototype.shiftZeroString = function(encoding)
{
  var zeroIndex = this.indexOf(0);

  if (zeroIndex === -1)
  {
    return '';
  }

  var zeroString = this.shiftString(zeroIndex, encoding);

  this.skip(1);

  return zeroString;
};

/**
 * Shifts a signed 8 bit integer.
 *
 * Decreases the reader's length by one byte.
 *
 * @returns {number} A number between -128 and 127.
 * @throws {Error} If the reader is empty.
 * @example
 * var int8 = reader.shiftInt8();
 */
BufferReader.prototype.shiftInt8 = function()
{
  var value = this.readInt8(0);

  this.skip(1);
  
  return value;
};

/**
 * Shifts a signed 16 bit integer.
 *
 * Decreases the reader's length by two bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -32768 and 32767.
 * @throws {Error} If the reader's length is less than 2.
 * @example
 * var int16BE = reader.shiftInt16();
 * var int16LE = reader.shiftInt16(true);
 */
BufferReader.prototype.shiftInt16 = function(littleEndian)
{
  var value = this.readInt16(0, littleEndian);

  this.skip(2);

  return value;
};

/**
 * Shifts a signed 32 bit integer.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -2147483648 and 2147483647.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var int32BE = reader.shiftInt32();
 * var int32LE = reader.shiftInt32(true);
 */
BufferReader.prototype.shiftInt32 = function(littleEndian)
{
  var value = this.readInt32(0, littleEndian);

  this.skip(4);

  return value;
};

/**
 * Shifts an unsigned 8 bit integer.
 *
 * Decreases the reader's length by one byte.
 *
 * @returns {number} A number between 0 and 255.
 * @throws {Error} If the reader is empty.
 * @example
 * var uint8 = reader.shiftUInt8();
 */
BufferReader.prototype.shiftUInt8 = function()
{
  var value = this.readUInt8(0);

  this.skip(1);

  return value;
};

/**
 * Shifts an unsigned 16 bit integer.
 *
 * Decreases the reader's length by two bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 65535.
 * @throws {Error} If the reader's length is less than 2.
 * @example
 * var uint16BE = reader.shiftUInt16();
 * var uint16LE = reader.shiftUInt16(true);
 */
BufferReader.prototype.shiftUInt16 = function(littleEndian)
{
  var value = this.readUInt16(0, littleEndian);

  this.skip(2);

  return value;
};

/**
 * Shifts an unsigned 32 bit integer.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 4294967295.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var uint32BE = reader.shiftUInt32();
 * var uint32LE = reader.shiftUInt32(true);
 */
BufferReader.prototype.shiftUInt32 = function(littleEndian)
{
  var value = this.readUInt32(0, littleEndian);

  this.skip(4);

  return value;
};

/**
 * Shifts a signed 32 bit floating-point number as defined in IEEE 754.
 *
 * Decreases the reader's length by four bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A 32 bit floating-point number.
 * @throws {Error} If the reader's length is less than 4.
 * @example
 * var floatBE = reader.shiftFloat();
 * var floatLE = reader.shiftFloat(true);
 */
BufferReader.prototype.shiftFloat = function(littleEndian)
{
  var value = this.readFloat(0, littleEndian);

  this.skip(4);

  return value;
};

/**
 * Shifts a signed 64 bit floating-point number as defined in IEEE 754.
 *
 * Decreases the reader's length by eight bytes.
 *
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A 64 bit floating-point number.
 * @throws {Error} If the reader's length is less than 8.
 * @example
 * var doubleBE = reader.shiftDouble();
 * var doubleLE = reader.shiftDouble(true);
 */
BufferReader.prototype.shiftDouble = function(littleEndian)
{
  var value = this.readDouble(0, littleEndian);

  this.skip(8);

  return value;
};

/**
 * Returns an array of bits (boolean values) starting at the specified offset.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @param {number} count A number of bits to read. Must be between 1 and
 * the reader's length multiplied by 8 minus the starting index.
 * @returns {Array.<boolean>} An array of bits.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length multiplied by 8 minus the starting index.
 * @example
 * var bitsArray = reader.readBits(5, 13);
 */
BufferReader.prototype.readBits = function(offset, count)
{
  // @todo bit or bytes offset
  return toBits(this.readBytes(offset, Math.ceil(count / 8)), count);
};

/**
 * Returns a byte at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {number} A number between 0x00 and 0xFF.
 * @throws {Error} If the reader is empty.
 * @example
 * var byteValue = reader.readByte(1);
 */
BufferReader.prototype.readByte = function(offset)
{
  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0 || offset >= this.length)
  {
    throw new Error(
      "The offset must be a number between 0 and the reader's length minus one."
    );
  }

  return this.buffer[this.offset + offset];
};

/**
 * Returns an ASCII character at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {string} An ASCII character.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var charValue = reader.readChar(4);
 */
BufferReader.prototype.readChar = function(offset)
{
  return String.fromCharCode(this.readByte(offset));
};

/**
 * Returns the specified number of bytes starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified count.
 * @param {number} count A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @returns {Array.<number>} An array of bytes.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length minus the offset.
 * @example
 * var bytesArray = reader.readBytes(0, 6);
 */
BufferReader.prototype.readBytes = function(offset, count)
{
  offset = parseInt(offset, 10);

  if (isNaN(offset) || offset < 0)
  {
    throw new Error("The offset must be a number greater than 0.");
  }

  count = parseInt(count, 10);

  if (isNaN(count) || count < 1)
  {
    throw new Error("The byte count must be a number greater than 0.");
  }

  if (offset + count > this.length)
  {
    throw new Error(
      "A sum of the offset and byte count must be less than " +
      "or equal to the reader's length."
    );
  }
  
  offset += this.offset;

  var byteArray = [];

  while (count--)
  {
    byteArray.push(this.buffer[offset++]);
  }

  return byteArray;
};

/**
 * Returns the specified number of bytes as an instance of Buffer
 * starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified count.
 * @param {number} count A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @returns {Buffer} A Buffer of bytes.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified count is not a number between 1 and
 * the reader's length minus the offset.
 * @example
 * var buffer = reader.readBuffer(5, 10);
 */
BufferReader.prototype.readBuffer = function(offset, count)
{
  return new Buffer(this.readBytes(offset, count));
};

/**
 * Returns the specified number of bytes as a string with
 * the specified encoding.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus the specified length.
 * @param {number} length A number of bytes to read.
 * Must be between 1 and the reader's length minus the offset.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string of the specified length.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified length is not a number between 1 and
 * the reader's length.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.readString(1, 12, 'ascii');
 */
BufferReader.prototype.readString = function(offset, length, encoding)
{
  return this.readBuffer(offset, length).toString(encoding || 'utf8');
};

/**
 * Returns a string from the specified offset until the first
 * occurence of the NULL character (\0).
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length.
 * @param {string} [encoding] An encoding of the string. Defaults to `utf8`.
 * @returns {string} A string constructed from the read bytes or empty string
 * if NULL character could not be found.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the specified encoding is not supported.
 * @example
 * var stringValue = reader.readZeroString(0, 'utf8');
 */
BufferReader.prototype.readZeroString = function(offset, encoding)
{
  var zeroIndex = this.indexOf(0, offset);

  if (zeroIndex === -1 || zeroIndex - offset === 0)
  {
    return '';
  }

  return this.readString(offset, zeroIndex - offset, encoding);
};

/**
 * Returns a signed 8 bit integer at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {number} A number between -128 and 127.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @throws {Error} If the reader is empty.
 * @example
 * var int8 = reader.readInt8(5);
 */
BufferReader.prototype.readInt8 = function(offset)
{
  return this.buffer.readInt8(this.offset + offset);
};

/**
 * Returns a signed 16 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 2.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -32768 and 32767.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var int16BE = reader.readInt16(0);
 * var int16LE = reader.readInt16(2, true);
 */
BufferReader.prototype.readInt16 = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readInt16LE' : 'readInt16BE'](
    this.offset + offset
  );
};

/**
 * Returns a signed 32 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between -2147483648 and 2147483647.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var int32BE = reader.readInt32(0);
 * var int32LE = reader.readInt32(4, true);
 */
BufferReader.prototype.readInt32 = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readInt32LE' : 'readInt32BE'](
    this.offset + offset
  );
};

/**
 * Returns an unsigned 8 bit integer at the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 1.
 * @returns {number} A number between 0 and 255.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint8 = reader.readUInt8(0);
 */
BufferReader.prototype.readUInt8 = function(offset)
{
  return this.buffer.readUInt8(this.offset + offset);
};

/**
 * Returns an unsigned 16 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 2.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 65535.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint16BE = reader.readUInt16(0);
 * var uint16LE = reader.readUInt16(2, true);
 */
BufferReader.prototype.readUInt16 = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readUInt16LE' : 'readUInt16BE'](
    this.offset + offset
  );
};

/**
 * Returns an unsigned 32 bit integer starting from the specified position.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A number between 0 and 4294967295.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var uint32BE = reader.readUInt32(0);
 * var uint32LE = reader.readUInt32(4, true);
 */
BufferReader.prototype.readUInt32 = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readUInt32LE' : 'readUInt32BE'](
    this.offset + offset
  );
};

/**
 * Returns a signed 32 bit floating-point number as defined in IEEE 754.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 4.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A 32 bit floating-point number.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var floatBE = reader.readFloat(0, );
 * var floatLE = reader.readFloat(4, true);
 */
BufferReader.prototype.readFloat = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readFloatLE' : 'readFloatBE'](
    this.offset + offset
  );
};

/**
 * Returns a signed 64 bit floating-point number as defined in IEEE 754.
 *
 * @param {number} offset A starting index.
 * Must be between 0 and the reader's length minus 8.
 * @param {boolean} [littleEndian] Whether to use little endian
 * instead of big endian.
 * @returns {number} A 64 bit floating-point number.
 * @throws {Error} If the specified offset exceeds the reader's boundries.
 * @example
 * var doubleBE = reader.readDouble(0);
 * var doubleLE = reader.readDouble(8, true);
 */
BufferReader.prototype.readDouble = function(offset, littleEndian)
{
  return this.buffer[littleEndian ? 'readDoubleLE' : 'readDoubleBE'](
    this.offset + offset
  );
};

module.exports = BufferReader;

}).call(this,require("buffer").Buffer)
},{"./helpers":82,"buffer":2}],82:[function(require,module,exports){
'use strict';

/**
 * @private
 * @param {Array.<number>} byteArray
 * @param {number} bitCount
 * @returns {Array.<boolean>}
 */
exports.toBits = function(byteArray, bitCount)
{
  var bitArray = [];
  var byteCount = byteArray.length;

  for (var byteIndex = 0; byteIndex < byteCount; ++byteIndex)
  {
    var byteValue = byteArray[byteIndex];

    for (var bitIndex = 0; bitIndex < 8; ++bitIndex)
    {
      if (bitArray.length === bitCount)
      {
        break;
      }

      bitArray.push(Boolean(byteValue & Math.pow(2, bitIndex)));
    }
  }

  return bitArray;
};

},{}],83:[function(require,module,exports){
exports.BufferQueueReader = require('./BufferQueueReader');
exports.BufferReader = require('./BufferReader');
exports.BufferBuilder = require('./BufferBuilder');

},{"./BufferBuilder":79,"./BufferQueueReader":80,"./BufferReader":81}]},{},[11]);
