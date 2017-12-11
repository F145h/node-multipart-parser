
let multipart_parser = function (boundary, cb) {
    this.data = {};
    this.index = 0;
    this.state = 2 /* s_start */;
    this.currentHeaders = {};
    this.currentHeaderName = String();
    this.currentHeaderValue = String();

    this.callbacks = cb;

    this.lookbehind = new Buffer(16);

    this.multipart_boundary = boundary;
    this.boundary_length = boundary.length;
};

multipart_parser.prototype.execute = function (buf, len) {
    let LF = 10;
    let CR = 13;
    var i = 0;
    var mark = 0;
    var c;
    var cl;
    var is_last = false;

    if (len === undefined)
        len = buf.length;

    while (i < len) {
        c = buf[i];
        is_last = (i === (len - 1));
        switch (this.state) {
            case 2/* s_start */:
                this.index = 0;
                this.state = 3 /* s_start_boundary */;

            case 3/* s_start_boundary */:
                if (this.index === this.boundary_length) {
                    if (c !== CR) {
                        return i;
                    }
                    this.index++;
                    break;
                } else if (this.index === (this.boundary_length + 1)) {
                    if (c !== LF) {
                        return i;
                    }
                    this.index = 0;
                    if (this.callbacks.on_part_data_begin !== undefined)
                        this.callbacks.on_part_data_begin();
                    this.currentHeaders = {};
                    this.state = 4 /* s_header_field_start */;
                    break;
                }
                if (c !== this.multipart_boundary[this.index]) {
                    return i;
                }
                this.index++;
                break;

            case 4/* s_header_field_start */:
                mark = i;
                this.state = 5 /* s_header_field */;

            case 5/* s_header_field */:
                if (c === CR) {
                    this.state = 6 /* s_headers_almost_done */;
                    break;
                }

                cl = String.fromCharCode(c).toLowerCase();
                if (cl === ':') {
                    var headerFieldName = buf.slice(mark, i);
                    if (this.callbacks.on_header_field !== undefined)
                        this.callbacks.on_header_field(headerFieldName);
                    this.currentHeaderName += headerFieldName;
                    this.state = 7 /* s_header_value_start */;
                    break;
                }

                if ((cl !== '-') && (cl < 'a' || cl > 'z')) {
                    return i;
                }
                if (is_last) {
                    var headerFieldName = (buf.slice(mark, i + 1));
                    if (this.callbacks.on_header_field !== undefined)
                        this.callbacks.on_header_field(headerFieldName);
                    this.currentHeaderName += headerFieldName;
                }
                break;

            case 6/* s_headers_almost_done */:
                if (c !== LF) {
                    return i;
                }

                this.state = 10 /* s_part_data_start */;
                break;

            case 7/* s_header_value_start */:
                if (c === ' ') {
                    break;
                }

                mark = i;
                this.state = 8 /* s_header_value */;

            case 8/* s_header_value */:
                if (c === CR) {
                    var headerFieldValue = buf.slice(mark, i);
                    if (this.callbacks.on_header_value !== undefined)
                        this.callbacks.on_header_value(headerFieldValue);
                    this.currentHeaderValue += headerFieldValue;
                    this.state = 9 /* s_header_value_almost_done */;
                    break;
                }
                if (is_last) {
                    var headerFieldValue = buf.slice(mark, (i + 1));
                    if (this.callbacks.on_header_value !== undefined)
                        this.callbacks.on_header_value(headerFieldValue);
                    this.currentHeaderValue += headerFieldValue;
                }
                break;

            case 9/* s_header_value_almost_done */:
                if (c !== LF) {
                    return i;
                }
                if (this.currentHeaderName.length > 0)
                    this.currentHeaders[this.currentHeaderName] = this.currentHeaderValue;
                this.currentHeaderName = String();
                this.currentHeaderValue = String();
                this.state = 4 /* s_header_field_start */;
                break;

            case 10/* s_part_data_start */:
                var contentName;
                if ("Content-Disposition" in this.currentHeaders) {
                    var splittedContent = this.currentHeaders["Content-Disposition"].split(";");
                    var contentParams = {};
                    for (var pc in splittedContent) {
                        var splittedPair = splittedContent[pc].trim().split("=");
                        if (splittedPair.length === 2) {
                            var paramName = removeQuotes(splittedPair[0].trim());
                            var paramValue = removeQuotes(splittedPair[1].trim());
                            if (paramName === "name") {
                                contentName = paramValue;
                            }
                            contentParams[paramName] = paramValue;
                        }
                    }
                }
                if (this.callbacks.on_headers_complete !== undefined)
                    this.callbacks.on_headers_complete(contentName, contentParams, this.currentHeaders);
                mark = i;
                this.state = 11 /* s_part_data */;

            case 11/* s_part_data */:
                if (c === CR) {
                    if (this.callbacks.on_part_data !== undefined)
                        this.callbacks.on_part_data(buf.slice(mark, i));
                    mark = i;
                    this.state = 12 /* s_part_data_almost_boundary */;
                    this.lookbehind[0] = CR;
                    break;
                }
                if (is_last) {
                    if (this.callbacks.on_part_data !== undefined)
                        this.callbacks.on_part_data(buf.slice(mark, (i + 1)));
                }
                break;

            case 12/* s_part_data_almost_boundary */:
                if (c === LF) {
                    this.state = 13 /* s_part_data_boundary */;
                    this.lookbehind[1] = LF;
                    this.index = 0;
                    break;
                }
                if (this.callbacks.on_part_data !== undefined)
                    this.callbacks.on_part_data(this.lookbehind.slice(0, 1));
                this.state = 11 /* s_part_data */;
                mark = i--;
                break;

            case 13/* s_part_data_boundary */:
                if (this.multipart_boundary[this.index] !== c) {
                    if (this.callbacks.on_part_data !== undefined) {
                        var lbf = this.lookbehind.slice(0, 2 + this.index);
                        this.callbacks.on_part_data(lbf);
                    }
                    this.state = 11 /* s_part_data */;
                    mark = i--;
                    break;
                }
                this.lookbehind[2 + this.index] = c;
                if ((++this.index) === this.boundary_length) {
                    if (this.callbacks.on_part_data_end !== undefined)
                        this.callbacks.on_part_data_end();
                    this.state = 14 /* s_part_data_almost_end */;
                }
                break;

            case 14/* s_part_data_almost_end */:
                if (c === '-') {
                    this.state = 16 /* s_part_data_final_hyphen */;
                    break;
                }
                if (c === CR) {
                    this.state = 15 /* s_part_data_end */;
                    break;
                }
                return i;

            case 16/* s_part_data_final_hyphen */:
                if (c === '-') {
                    if (this.callbacks.on_body_end !== undefined)
                        this.callbacks.on_body_end();
                    this.state = 17 /* s_end */;
                    break;
                }
                return i;

            case 15/* s_part_data_end */:
                if (c === LF) {
                    this.state = 4 /* s_header_field_start */;
                    this.currentHeaders = {};
                    if (this.callbacks.on_part_data_begin !== undefined)
                        this.callbacks.on_part_data_begin();
                    break;
                }
                return i;

            case 17/* s_end */:
                break;

            default:
                return 0;
        }
        ++i;
    }

    return len;
};


module.exports = multipart_parser;
