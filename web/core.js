(function (root) {
  "use strict";

  const TEMPLATE_BASE64 =
    "U1AzVDAwMDIAAABvAAAAb2h2Y0MBBAgAAAC/yAAAAABa8AD8/Pj4AAALA6AAAQAXQAEMAf//BAgAAAMAv8gAAAMAAFoXAkChAAEAIUIBAQQIAAADAL/IAAADAABawBgIAkFiBeSRZVNwICAgCKIAAQAJRAHAYdJCEBTJAAMAQQAAAJwAAACYKAGvEl1KLmsWuFaLOv9pZzkjJ2BT9fwAAAMAAAMAAAMAAAMBGwoMWAAAAwAAAwAAAwAAAwAABpwAAAMAAAMAAAMAAAMAAAMAPKAAAAMAAAMAAAMAAAMAA1IAAAMAAAMAAAMAAAMDKgAAAwAAAwAAAwAAdMAAAAMAAAMAAAMAA/wAAAMAAAMAAAMADqgAAAMAAAMAAAMAKCAAQgAAAWU8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA2LjAuMCI+CiAgIDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+CiAgICAgIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICAgICAgICAgIHhtbG5zOmZzaW5jTWF0dGVzPSJodHRwOi8vbnMuYXBwbGUuY29tL2ZzaW5jLzEuMC8iPgogICAgICAgICA8ZnNpbmNNYXR0ZXM6RlNJTkNNYXR0ZVZlcnNpb24+MDwvZnNpbmNNYXR0ZXM6RlNJTkNNYXR0ZVZlcnNpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoAjQAAANZicGxpc3QwMNcBAgMEBQYHCAkKCwwNDlZQcmVzZXRbQ2FwdHVyZVR5cGVbQ2FwdHVyZU1vZGVYUG9ydFR5cGVdSGFyZHdhcmVNb2RlbF8QHVRleHR1cmVTdHlsZVBlb3BsZURhdGFWZXJzaW9uXUZpbG1HcmFpblNlZWRWRmlsbWljUkxGVVN0aWxsXFBvcnRUeXBlQmFja1ppUGhvbmUxOSw3EAMQkggXHio2P01te4KFi5ijpQAAAAAAAAEBAAAAAAAAAA8AAAAAAAAAAAAAAAAAAACn";

  const STYLE_2_URI = "tag:apple.com,2023:photo:metadata:styles";
  const STYLE_3_URI = "tag:apple.com,2026:photo:metadata:texture_styles";
  const MATTE_MARKER = "tag:apple.com,2026:photo:aux:semanticfaceskinmatte";
  const MATTE_URIS = [
    "tag:apple.com,2026:photo:aux:semanticnosematte",
    "tag:apple.com,2026:photo:aux:semanticskinmattev2",
    "tag:apple.com,2026:photo:aux:semanticnonfaceskinmatte",
    "tag:apple.com,2026:photo:aux:semanticlipsmatte",
    "tag:apple.com,2026:photo:aux:semanticteethmattev2",
    "tag:apple.com,2026:photo:aux:semanticpersonmatte",
    "tag:apple.com,2026:photo:aux:semanticglassesmattev2",
    "tag:apple.com,2026:photo:aux:semanticeyebrowsmatte",
    "tag:apple.com,2026:photo:aux:semantictattoomatte",
    "tag:apple.com,2026:photo:aux:semantichandsmatte",
    "tag:apple.com,2026:photo:aux:semanticearsmatte",
    "tag:apple.com,2026:photo:aux:semanticfaceskinmatte",
  ];

  class StylePortError extends Error {
    constructor(message, code = "conversion") {
      super(message);
      this.name = "StylePortError";
      this.code = code;
    }
  }

  function malformed(message) {
    throw new StylePortError(`HEIC 文件结构不完整：${message}`, "malformed");
  }

  function ascii(text) {
    const output = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
      const value = text.charCodeAt(index);
      if (value > 255) throw malformed("遇到无法识别的标识");
      output[index] = value;
    }
    return output;
  }

  function decodeBase64(text) {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const clean = text.replace(/\s/g, "");
    const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
    const output = new Uint8Array((clean.length * 3) / 4 - padding);
    let outputIndex = 0;
    for (let index = 0; index < clean.length; index += 4) {
      const a = alphabet.indexOf(clean[index]);
      const b = alphabet.indexOf(clean[index + 1]);
      const c = clean[index + 2] === "=" ? 0 : alphabet.indexOf(clean[index + 2]);
      const d = clean[index + 3] === "=" ? 0 : alphabet.indexOf(clean[index + 3]);
      const value = (a << 18) | (b << 12) | (c << 6) | d;
      if (outputIndex < output.length) output[outputIndex++] = value >> 16;
      if (outputIndex < output.length) output[outputIndex++] = value >> 8;
      if (outputIndex < output.length) output[outputIndex++] = value;
    }
    return output;
  }

  const TEMPLATE_DATA = decodeBase64(TEMPLATE_BASE64);

  function concat(parts) {
    let length = 0;
    for (const part of parts) length += part.length;
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) {
      output.set(part, offset);
      offset += part.length;
    }
    return output;
  }

  function bigEndian(value, byteCount) {
    const output = new Uint8Array(byteCount);
    let remaining = value;
    for (let index = byteCount - 1; index >= 0; index -= 1) {
      output[index] = remaining % 256;
      remaining = Math.floor(remaining / 256);
    }
    if (remaining !== 0) {
      throw new StylePortError("转换后的数据偏移超出 HEIC 支持范围。", "unsupported");
    }
    return output;
  }

  function bigEndian64(value) {
    const output = new Uint8Array(8);
    let remaining = BigInt(value);
    for (let index = 7; index >= 0; index -= 1) {
      output[index] = Number(remaining & 255n);
      remaining >>= 8n;
    }
    return output;
  }

  function asciiString(data, start, length) {
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += String.fromCharCode(data[start + index]);
    }
    return result;
  }

  function startsWithAscii(data, text) {
    if (data.length < text.length) return false;
    for (let index = 0; index < text.length; index += 1) {
      if (data[index] !== text.charCodeAt(index)) return false;
    }
    return true;
  }

  function indexOfAscii(data, text) {
    const needle = ascii(text);
    const lastStart = data.length - needle.length;
    outer: for (let start = 0; start <= lastStart; start += 1) {
      for (let index = 0; index < needle.length; index += 1) {
        if (data[start + index] !== needle[index]) continue outer;
      }
      return start;
    }
    return -1;
  }

  class Reader {
    constructor(data, offset) {
      this.data = data;
      this.offset = offset;
    }

    ensure(length) {
      if (this.offset + length > this.data.length) {
        malformed("数据提前结束");
      }
    }

    readUInt8() {
      this.ensure(1);
      return this.data[this.offset++];
    }

    readUInt16() {
      this.ensure(2);
      const value = (this.data[this.offset] << 8) | this.data[this.offset + 1];
      this.offset += 2;
      return value >>> 0;
    }

    readUInt24() {
      this.ensure(3);
      const value =
        this.data[this.offset] * 65536 +
        this.data[this.offset + 1] * 256 +
        this.data[this.offset + 2];
      this.offset += 3;
      return value;
    }

    readUInt32() {
      this.ensure(4);
      const value =
        this.data[this.offset] * 16777216 +
        this.data[this.offset + 1] * 65536 +
        this.data[this.offset + 2] * 256 +
        this.data[this.offset + 3];
      this.offset += 4;
      return value;
    }

    readUInt64() {
      const high = this.readUInt32();
      const low = this.readUInt32();
      const value = high * 4294967296 + low;
      if (!Number.isSafeInteger(value)) {
        throw new StylePortError("文件中的偏移超出浏览器安全范围。", "unsupported");
      }
      return value;
    }

    readUInt(byteCount) {
      if (byteCount < 0 || byteCount > 8) malformed("数值宽度无效");
      let value = 0;
      for (let index = 0; index < byteCount; index += 1) {
        value = value * 256 + this.readUInt8();
      }
      if (!Number.isSafeInteger(value)) {
        throw new StylePortError("文件中的偏移超出浏览器安全范围。", "unsupported");
      }
      return value;
    }

    readFourCC() {
      this.ensure(4);
      const value = asciiString(this.data, this.offset, 4);
      this.offset += 4;
      return value;
    }
  }

  function boxes(data, start, end) {
    if (start < 0 || end > data.length || start > end) {
      malformed("box 范围无效");
    }
    const result = [];
    let position = start;
    while (position + 8 <= end) {
      const reader = new Reader(data, position);
      const size32 = reader.readUInt32();
      const type = reader.readFourCC();
      let headerSize = 8;
      let size = size32;
      if (size32 === 1) {
        if (position + 16 > end) malformed("大型 box 被截断");
        headerSize = 16;
        size = reader.readUInt64();
      } else if (size32 === 0) {
        size = end - position;
      }
      if (size < headerSize || size > Number.MAX_SAFE_INTEGER || position + size > end) {
        malformed(`${type} box 大小无效`);
      }
      result.push({
        type,
        start: position,
        headerSize,
        size,
        payloadStart: position + headerSize,
        end: position + size,
      });
      position += size;
    }
    if (position !== end) malformed("box 容器末尾有残缺数据");
    return result;
  }

  function fullBox(box, data) {
    const reader = new Reader(data, box.payloadStart);
    return {
      version: reader.readUInt8(),
      flags: reader.readUInt24(),
      reader,
    };
  }

  function items(iinf, data) {
    const full = fullBox(iinf, data);
    const reader = full.reader;
    const count = full.version === 0 ? reader.readUInt16() : reader.readUInt32();
    const entries = boxes(data, reader.offset, iinf.end);
    if (entries.length < count) malformed("项目数量与声明不一致");
    const result = [];
    for (const entry of entries.slice(0, count)) {
      if (entry.type !== "infe") continue;
      const entryFull = fullBox(entry, data);
      const entryReader = entryFull.reader;
      let id;
      if (entryFull.version === 2) id = entryReader.readUInt16();
      else if (entryFull.version >= 3) id = entryReader.readUInt32();
      else continue;
      entryReader.readUInt16();
      result.push({ id, type: entryReader.readFourCC() });
    }
    return result;
  }

  function locations(iloc, data) {
    const full = fullBox(iloc, data);
    const reader = full.reader;
    const first = reader.readUInt8();
    const second = reader.readUInt8();
    const layout = {
      version: full.version,
      flags: full.flags,
      offsetSize: first >> 4,
      lengthSize: first & 15,
      baseOffsetSize: second >> 4,
      indexSize: full.version === 1 || full.version === 2 ? second & 15 : 0,
    };
    const count =
      layout.version < 2 ? reader.readUInt16() : reader.readUInt32();
    const result = [];
    for (let itemIndex = 0; itemIndex < count; itemIndex += 1) {
      const itemID =
        layout.version < 2 ? reader.readUInt16() : reader.readUInt32();
      const constructionMethod =
        layout.version === 1 || layout.version === 2
          ? reader.readUInt16() & 15
          : 0;
      const dataReferenceIndex = reader.readUInt16();
      const baseOffset = reader.readUInt(layout.baseOffsetSize);
      const extentCount = reader.readUInt16();
      const extents = [];
      for (let extentIndex = 0; extentIndex < extentCount; extentIndex += 1) {
        const extentOffset =
          layout.indexSize > 0 ? reader.readUInt(layout.indexSize) : 0;
        const offset = reader.readUInt(layout.offsetSize);
        const length = reader.readUInt(layout.lengthSize);
        extents.push({ index: extentOffset, offset, length });
      }
      result.push({
        itemID,
        constructionMethod,
        dataReferenceIndex,
        baseOffset,
        extents,
      });
    }
    return { layout, locations: result };
  }

  function serializeLocations(itemLocations, layout) {
    const parts = [
      new Uint8Array([layout.version]),
      bigEndian(layout.flags, 3),
      new Uint8Array([
        (layout.offsetSize << 4) | layout.lengthSize,
        (layout.baseOffsetSize << 4) | layout.indexSize,
      ]),
    ];
    if (layout.version < 2) {
      if (itemLocations.length > 65535) {
        throw new StylePortError("HEIF 项目数量过多。", "unsupported");
      }
      parts.push(bigEndian(itemLocations.length, 2));
    } else {
      parts.push(bigEndian(itemLocations.length, 4));
    }
    for (const location of itemLocations) {
      if (layout.version < 2) {
        if (location.itemID > 65535) {
          throw new StylePortError("项目编号超出 HEIC 支持范围。", "unsupported");
        }
        parts.push(bigEndian(location.itemID, 2));
      } else {
        parts.push(bigEndian(location.itemID, 4));
      }
      if (layout.version === 1 || layout.version === 2) {
        parts.push(bigEndian(location.constructionMethod & 15, 2));
      }
      parts.push(bigEndian(location.dataReferenceIndex, 2));
      parts.push(bigEndian(location.baseOffset, layout.baseOffsetSize));
      if (location.extents.length > 65535) {
        throw new StylePortError("HEIF 数据段数量过多。", "unsupported");
      }
      parts.push(bigEndian(location.extents.length, 2));
      for (const extent of location.extents) {
        if (layout.indexSize > 0) {
          parts.push(bigEndian(extent.index, layout.indexSize));
        }
        parts.push(bigEndian(extent.offset, layout.offsetSize));
        parts.push(bigEndian(extent.length, layout.lengthSize));
      }
    }
    return makeBox("iloc", concat(parts));
  }

  function makeBox(type, payload) {
    if (type.length !== 4) malformed("box 类型无效");
    const size = payload.length + 8;
    if (size > 4294967295) {
      throw new StylePortError("转换后的文件超过网页版单文件 4 GB 上限。", "unsupported");
    }
    return concat([bigEndian(size, 4), ascii(type), payload]);
  }

  function parseTemplate(data) {
    if (data.length < 14 || asciiString(data, 0, 8) !== "SP3T0002") {
      malformed("内置摄影风格模板无效");
    }
    const reader = new Reader(data, 8);
    const hvccLength = reader.readUInt32();
    if (reader.offset + hvccLength > data.length) malformed("模板 hvcC 被截断");
    const matteHVCC = data.slice(reader.offset, reader.offset + hvccLength);
    reader.offset += hvccLength;
    const count = reader.readUInt16();
    const payloads = new Map();
    for (let index = 0; index < count; index += 1) {
      const id = reader.readUInt16();
      const length = reader.readUInt32();
      if (reader.offset + length > data.length) malformed("模板数据被截断");
      payloads.set(id, data.slice(reader.offset, reader.offset + length));
      reader.offset += length;
    }
    return {
      matteHVCC,
      blackMatte: payloads.get(65),
      matteXMP: payloads.get(66),
      textureStyles: payloads.get(141),
    };
  }

  function extractPhotoData(source) {
    if (
      source.length < 12 ||
      asciiString(source, source.length - 12, 4) !== "livp"
    ) {
      return source;
    }
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    const movieLength = view.getUint32(source.length - 4, true);
    if (movieLength < 8 || source.length < 28 || movieLength > source.length - 28) {
      malformed("内嵌实况照片的视频长度无效");
    }
    const header = source.length - 28 - movieLength;
    if (
      header < 8 ||
      asciiString(source, header + 4, 4) !== "uuid" ||
      view.getUint32(header, true) !== movieLength + 16
    ) {
      malformed("内嵌实况照片的头部无效");
    }
    for (let index = header + 8; index < header + 16; index += 1) {
      if (source[index] !== 0) malformed("内嵌实况照片的标识无效");
    }
    const photo = source.slice(0, header);
    const movie = source.slice(header + 16, source.length - 12);
    for (const [data, required, label] of [
      [photo, ["ftyp", "meta", "mdat"], "照片"],
      [movie, ["ftyp", "moov", "mdat"], "视频"],
    ]) {
      const top = boxes(data, 0, data.length);
      const present = new Set(top.map((box) => box.type));
      if (top[0]?.type !== "ftyp" || required.some((type) => !present.has(type))) {
        malformed(`内嵌${label}资源不完整`);
      }
    }
    return photo;
  }

  function inspect(source) {
    const hasStyles = indexOfAscii(source, STYLE_2_URI) !== -1;
    const hasTexture = indexOfAscii(source, STYLE_3_URI) !== -1;
    return {
      hasStyles,
      hasTexture,
      compatible: hasStyles && !hasTexture,
      alreadyConverted: hasTexture,
    };
  }

  function primaryItemID(pitm, data) {
    const full = fullBox(pitm, data);
    return full.version === 0 ? full.reader.readUInt16() : full.reader.readUInt32();
  }

  function makeINFE(id, type, name, trailing) {
    if (id > 65535) {
      throw new StylePortError("项目编号超出 HEIF 支持范围。", "unsupported");
    }
    const payload = concat([
      new Uint8Array([2, 0, 0, 1]),
      bigEndian(id, 2),
      new Uint8Array([0, 0]),
      ascii(type),
      ascii(name),
      new Uint8Array([0]),
      trailing,
    ]);
    return makeBox("infe", payload);
  }

  function buildIINF(iinf, data, matteIDs, xmpIDs, textureID) {
    const full = fullBox(iinf, data);
    const reader = full.reader;
    const oldCount =
      full.version === 0 ? reader.readUInt16() : reader.readUInt32();
    const newCount = oldCount + 25;
    if (full.version === 0 && newCount > 65535) {
      throw new StylePortError("HEIF 项目数量过多。", "unsupported");
    }
    const parts = [
      new Uint8Array([full.version]),
      bigEndian(full.flags, 3),
      bigEndian(newCount, full.version === 0 ? 2 : 4),
      data.subarray(reader.offset, iinf.end),
    ];
    for (let index = 0; index < 12; index += 1) {
      parts.push(makeINFE(matteIDs[index], "hvc1", "", new Uint8Array()));
      parts.push(
        makeINFE(
          xmpIDs[index],
          "mime",
          "",
          concat([ascii("application/rdf+xml"), new Uint8Array([0, 0])])
        )
      );
    }
    parts.push(
      makeINFE(
        textureID,
        "uri ",
        "metadata",
        concat([ascii(STYLE_3_URI), new Uint8Array([0])])
      )
    );
    return makeBox("iinf", concat(parts));
  }

  function makeISPE(width, height) {
    const payload = concat([
      new Uint8Array(4),
      bigEndian(width, 4),
      bigEndian(height, 4),
    ]);
    return makeBox("ispe", payload);
  }

  function makeAuxC(uri) {
    return makeBox(
      "auxC",
      concat([new Uint8Array(4), ascii(uri), new Uint8Array([0])])
    );
  }

  function appendIPMA(ipma, data, matteIDs, indexes) {
    const full = fullBox(ipma, data);
    if ((full.flags & 1) !== 0) {
      throw new StylePortError("暂不支持此照片的宽属性关联格式。", "unsupported");
    }
    const reader = full.reader;
    const oldCount = reader.readUInt32();
    const parts = [
      new Uint8Array([full.version]),
      bigEndian(full.flags, 3),
      bigEndian(oldCount + matteIDs.length, 4),
      data.subarray(reader.offset, ipma.end),
    ];
    matteIDs.forEach((itemID, offset) => {
      parts.push(bigEndian(itemID, full.version < 1 ? 2 : 4));
      const associations = [
        [indexes.ispe, false],
        [indexes.monoPixi, false],
        [indexes.auxC[offset], true],
        [indexes.hvcc, true],
        [indexes.rotation, true],
      ];
      parts.push(new Uint8Array([associations.length]));
      for (const [propertyIndex, essential] of associations) {
        if (propertyIndex > 127) {
          throw new StylePortError("照片的属性索引超出网页版支持范围。", "unsupported");
        }
        parts.push(new Uint8Array([propertyIndex | (essential ? 128 : 0)]));
      }
    });
    return makeBox("ipma", concat(parts));
  }

  function buildIPRP(iprp, data, template, matteIDs) {
    const children = boxes(data, iprp.payloadStart, iprp.end);
    const ipco = children.find((box) => box.type === "ipco");
    const ipma = children.find((box) => box.type === "ipma");
    if (!ipco || !ipma) malformed("缺少 ipco 或 ipma");
    const oldProperties = boxes(data, ipco.payloadStart, ipco.end);
    const monoIndex = oldProperties.findIndex(
      (property) =>
        property.type === "pixi" &&
        property.size === 14 &&
        data[property.payloadStart + 4] === 1 &&
        data[property.payloadStart + 5] === 8
    );
    if (monoIndex < 0) {
      throw new StylePortError(
        "这张照片缺少兼容的单色蒙版像素属性。",
        "incompatible"
      );
    }
    const rotationIndex = oldProperties.findIndex(
      (property) => property.type === "irot"
    );
    if (rotationIndex < 0) {
      throw new StylePortError("这张照片缺少方向信息。", "incompatible");
    }

    const propertyParts = [data.subarray(ipco.payloadStart, ipco.end)];
    let nextIndex = oldProperties.length + 1;
    const ispeIndex = nextIndex++;
    propertyParts.push(makeISPE(768, 576));
    const auxC = [];
    for (const uri of MATTE_URIS) {
      propertyParts.push(makeAuxC(uri));
      auxC.push(nextIndex++);
    }
    propertyParts.push(template.matteHVCC);
    const hvccIndex = nextIndex;
    const indexes = {
      ispe: ispeIndex,
      monoPixi: monoIndex + 1,
      auxC,
      hvcc: hvccIndex,
      rotation: rotationIndex + 1,
    };
    const newIPCO = makeBox("ipco", concat(propertyParts));
    const newIPMA = appendIPMA(ipma, data, matteIDs, indexes);
    const parts = [];
    for (const child of children) {
      if (child.type === "ipco") parts.push(newIPCO);
      else if (child.type === "ipma") parts.push(newIPMA);
      else parts.push(data.subarray(child.start, child.end));
    }
    return { data: makeBox("iprp", concat(parts)), indexes };
  }

  function makeReference(type, from, targets) {
    if (from > 65535 || targets.some((target) => target > 65535)) {
      throw new StylePortError("照片引用的项目编号超出 HEIF 支持范围。", "unsupported");
    }
    const parts = [
      bigEndian(from, 2),
      bigEndian(targets.length, 2),
      ...targets.map((target) => bigEndian(target, 2)),
    ];
    return makeBox(type, concat(parts));
  }

  function buildIREF(
    iref,
    data,
    matteIDs,
    xmpIDs,
    textureID,
    primaryID,
    tmapID
  ) {
    const full = fullBox(iref, data);
    if (full.version !== 0) {
      throw new StylePortError("暂不支持 32 位照片引用格式。", "unsupported");
    }
    const parts = [
      new Uint8Array([full.version]),
      bigEndian(full.flags, 3),
      data.subarray(iref.payloadStart + 4, iref.end),
    ];
    for (let index = 0; index < 12; index += 1) {
      parts.push(
        makeReference("auxl", matteIDs[index], [primaryID, tmapID])
      );
      parts.push(makeReference("cdsc", xmpIDs[index], [matteIDs[index]]));
    }
    parts.push(makeReference("cdsc", textureID, [primaryID, tmapID]));
    return makeBox("iref", concat(parts));
  }

  function shiftLocation(location, delta) {
    if (location.constructionMethod !== 0) return location;
    const shifted = {
      ...location,
      extents: location.extents.map((extent) => ({ ...extent })),
    };
    if (shifted.baseOffset > 0) shifted.baseOffset += delta;
    else {
      for (const extent of shifted.extents) extent.offset += delta;
    }
    if (
      !Number.isSafeInteger(shifted.baseOffset) ||
      shifted.extents.some(
        (extent) =>
          !Number.isSafeInteger(extent.offset) ||
          !Number.isSafeInteger(extent.length)
      )
    ) {
      throw new StylePortError("照片数据偏移超出浏览器安全范围。", "unsupported");
    }
    return shifted;
  }

  function rebuildMeta(data, meta, children, replacements) {
    const parts = [data.subarray(meta.payloadStart, meta.payloadStart + 4)];
    for (const child of children) {
      parts.push(
        replacements.get(child.type) || data.subarray(child.start, child.end)
      );
    }
    return makeBox("meta", concat(parts));
  }

  function growMDAT(mdat, data, appended) {
    const payload = concat([data.subarray(mdat.payloadStart, mdat.end), appended]);
    if (mdat.headerSize === 16) {
      return concat([
        bigEndian(1, 4),
        ascii("mdat"),
        bigEndian64(payload.length + 16),
        payload,
      ]);
    }
    return makeBox("mdat", payload);
  }

  function convert(source, options = {}) {
    let data = source;
    let extractedLivePhoto = false;
    if (indexOfAscii(data, STYLE_2_URI) === -1) {
      const photo = extractPhotoData(data);
      extractedLivePhoto = photo !== data;
      data = photo;
    }
    const status = inspect(data);
    if (status.alreadyConverted) {
      return {
        data,
        alreadyConverted: true,
        extractedLivePhoto,
        inputBytes: source.length,
      };
    }
    if (!status.hasStyles) {
      throw new StylePortError(
        "这张照片不含可转换的“摄影风格 2”数据。",
        "incompatible"
      );
    }

    const template = parseTemplate(options.template || TEMPLATE_DATA);
    if (
      !template.blackMatte ||
      !template.matteXMP ||
      !template.textureStyles
    ) {
      malformed("内置摄影风格 3 模板不完整");
    }

    const top = boxes(data, 0, data.length);
    const meta = top.find((box) => box.type === "meta");
    const mdat = top.find((box) => box.type === "mdat");
    if (!meta || !mdat) malformed("缺少 meta 或 mdat");
    if (meta.end > mdat.start) {
      throw new StylePortError("暂不支持照片数据位于元数据之前的布局。", "unsupported");
    }
    const children = boxes(data, meta.payloadStart + 4, meta.end);
    const pitm = children.find((box) => box.type === "pitm");
    const iinf = children.find((box) => box.type === "iinf");
    const iref = children.find((box) => box.type === "iref");
    const iprp = children.find((box) => box.type === "iprp");
    const iloc = children.find((box) => box.type === "iloc");
    if (!pitm || !iinf || !iref || !iprp || !iloc) {
      malformed("缺少必要的照片项目结构");
    }

    const allItems = items(iinf, data);
    const nextID =
      (allItems.length ? Math.max(...allItems.map((item) => item.id)) : 0) + 1;
    if (nextID + 24 > 65535) {
      malformed("照片项目编号空间不足");
    }
    const matteIDs = Array.from({ length: 12 }, (_, index) => nextID + index * 2);
    const xmpIDs = matteIDs.map((id) => id + 1);
    const textureID = nextID + 24;
    const primaryID = primaryItemID(pitm, data);
    const tmapItem = allItems.find((item) => item.type === "tmap");
    if (!tmapItem) {
      throw new StylePortError(
        "这张照片缺少转换所需的 HDR 色调映射数据。",
        "incompatible"
      );
    }

    const newIINF = buildIINF(iinf, data, matteIDs, xmpIDs, textureID);
    const iprpResult = buildIPRP(iprp, data, template, matteIDs);
    const newIREF = buildIREF(
      iref,
      data,
      matteIDs,
      xmpIDs,
      textureID,
      primaryID,
      tmapItem.id
    );

    const appendedParts = [];
    const payloadLocations = [];
    let appendedLength = 0;
    for (let index = 0; index < 12; index += 1) {
      appendedParts.push(template.blackMatte);
      payloadLocations.push({
        id: matteIDs[index],
        offset: appendedLength,
        length: template.blackMatte.length,
      });
      appendedLength += template.blackMatte.length;
      appendedParts.push(template.matteXMP);
      payloadLocations.push({
        id: xmpIDs[index],
        offset: appendedLength,
        length: template.matteXMP.length,
      });
      appendedLength += template.matteXMP.length;
    }
    appendedParts.push(template.textureStyles);
    payloadLocations.push({
      id: textureID,
      offset: appendedLength,
      length: template.textureStyles.length,
    });
    const appended = concat(appendedParts);

    const locationResult = locations(iloc, data);
    const placeholderLocations = locationResult.locations.concat(
      payloadLocations.map((payload) => ({
        itemID: payload.id,
        constructionMethod: 0,
        dataReferenceIndex: 0,
        baseOffset: 0,
        extents: [{ index: 0, offset: 0, length: payload.length }],
      }))
    );
    const placeholderILOC = serializeLocations(
      placeholderLocations,
      locationResult.layout
    );
    const replacements = new Map([
      ["iinf", newIINF],
      ["iref", newIREF],
      ["iprp", iprpResult.data],
      ["iloc", placeholderILOC],
    ]);
    const placeholderMeta = rebuildMeta(
      data,
      meta,
      children,
      replacements
    );
    const delta = placeholderMeta.length - meta.size;
    if (delta < 0) malformed("元数据大小变化异常");

    const appendBase = mdat.end + delta;
    const shiftedLocations = locationResult.locations
      .map((location) => shiftLocation(location, delta))
      .concat(
        payloadLocations.map((payload) => ({
          itemID: payload.id,
          constructionMethod: 0,
          dataReferenceIndex: 0,
          baseOffset: 0,
          extents: [
            {
              index: 0,
              offset: appendBase + payload.offset,
              length: payload.length,
            },
          ],
        }))
      );
    replacements.set(
      "iloc",
      serializeLocations(shiftedLocations, locationResult.layout)
    );
    const newMeta = rebuildMeta(data, meta, children, replacements);
    if (newMeta.length - meta.size !== delta) {
      malformed("两次计算的元数据大小不一致");
    }
    const newMDAT = growMDAT(mdat, data, appended);

    const outputParts = [];
    for (const box of top) {
      if (box.type === "meta") outputParts.push(newMeta);
      else if (box.type === "mdat") outputParts.push(newMDAT);
      else outputParts.push(data.subarray(box.start, box.end));
    }
    const output = concat(outputParts);
    if (
      indexOfAscii(output, STYLE_3_URI) === -1 ||
      indexOfAscii(output, MATTE_MARKER) === -1
    ) {
      malformed("摄影风格 3 数据完整性检查未通过");
    }
    return {
      data: output,
      alreadyConverted: false,
      extractedLivePhoto,
      inputBytes: source.length,
      addedBytes: output.length - data.length,
    };
  }

  root.StylePortCore = {
    convert,
    inspect,
    extractPhotoData,
    StylePortError,
    constants: { STYLE_2_URI, STYLE_3_URI, MATTE_MARKER },
  };
})(typeof globalThis === "undefined" ? this : globalThis);
