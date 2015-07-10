
function read_header_name(name) {
    console.log("[read_header_name: " + name + "]");
}

function read_header_value(value) {
    console.log("[read_header_value: " + value + "]");
}

function read_data(data) {
    console.log("read_data: " + data);
}

var LF = "\x0a";
var CR = "\x0d";

module.exports.callbacks = function () {
    this.on_header_field = null;
    this.on_header_value = null;
    this.on_part_data = null;

    this.on_part_data_begin = null;
    this.on_headers_complete = null;
    this.on_part_data_end = null;
    this.on_body_end = null;
};

module.exports.parser = function (boundary, settings) {
    this.data = {};
    this.index = 0;
    this.state = 2 /* s_start */;
    this.currentHeaders = {};
    this.currentHeaderName = String();
    this.currentHeaderValue = String();

    this.settings = settings;

    this.lookbehind = new Array(16);

    this.boundary_length = boundary.length;
    this.multipart_boundary = boundary;

    this.execute = function (buf, len) {
        var i = 0;
        var mark = 0;
        var c;
        var cl;
        var is_last = false;

        if (len == undefined)
            len = buf.length;

        while (i < len) {
            c = buf[i];
            is_last = (i == (len - 1));
            switch (this.state) {
                case 2/* s_start */:
                    this.index = 0;
                    this.state = 3 /* s_start_boundary */;

                case 3/* s_start_boundary */:
                    if (this.index == this.boundary_length) {
                        if (c != CR) {
                            return i;
                        }
                        this.index++;
                        break;
                    } else if (this.index == (this.boundary_length + 1)) {
                        if (c != LF) {
                            return i;
                        }
                        this.index = 0;
                        if (this.settings.on_part_data_begin != null)
                            this.settings.on_part_data_begin();
                        this.currentHeaders = {};
                        this.state = 4 /* s_header_field_start */;
                        break;
                    }
                    if (c != this.multipart_boundary[this.index]) {
                        return i;
                    }
                    this.index++;
                    break;

                case 4/* s_header_field_start */:
                    mark = i;
                    this.state = 5 /* s_header_field */;

                case 5/* s_header_field */:
                    if (c == CR) {
                        this.state = 6 /* s_headers_almost_done */;
                        break;
                    }

                    if (c == ':') {
                        var headerFieldName = buf.substring(mark, i);
                        if (this.settings.on_header_field != null)
                            this.settings.on_header_field(headerFieldName);
                        this.currentHeaderName += headerFieldName
                        this.state = 7 /* s_header_value_start */;
                        break;
                    }

                    cl = c.toLowerCase();
                    if ((c != '-') && (cl < 'a' || cl > 'z')) {
                        return i;
                    }
                    if (is_last) {
                        var headerFieldName = (buf.substring(mark, i + 1));
                        if (this.settings.on_header_field != null)
                            this.settings.on_header_field(headerFieldName);
                        this.currentHeaderName += headerFieldName
                    }
                    break;

                case 6/* s_headers_almost_done */:
                    if (c != LF) {
                        return i;
                    }

                    this.state = 10 /* s_part_data_start */;
                    break;

                case 7/* s_header_value_start */:
                    if (c == ' ') {
                        break;
                    }

                    mark = i;
                    this.state = 8 /* s_header_value */;

                case 8/* s_header_value */:
                    if (c == CR) {
                        var headerFieldValue = buf.substring(mark, i)
                        if (this.settings.on_header_value != null)
                            this.settings.on_header_value(headerFieldValue);
                        this.currentHeaderValue += headerFieldValue
                        this.state = 9 /* s_header_value_almost_done */;
                        break;
                    }
                    if (is_last) {
                        var headerFieldValue = buf.substring(mark, (i + 1))
                        if (this.settings.on_header_value != null)
                            this.settings.on_header_value(headerFieldValue);
                        this.currentHeaderValue += headerFieldValue
                    }
                    break;

                case 9/* s_header_value_almost_done */:
                    if (c != LF) {
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
                        for (var pc in splittedContent) {
                            var splittedPair = splittedContent[pc].trim().split("=")
                            if (splittedPair.length == 2 && splittedPair[0].trim() == "name") {
                                var nameValue = splittedPair[1].trim();
                                if (nameValue.length > 2 && nameValue[0] == nameValue[nameValue.length - 1] && (nameValue[0] == "'" || nameValue[0] == "\""))
                                    contentName = nameValue.substring(1, nameValue.length - 1);
                                else
                                    contentName = nameValue;
                            }
                        }
                    }
                    if (this.settings.on_headers_complete != null)
                        this.settings.on_headers_complete(contentName, this.currentHeaders);
                    mark = i;
                    this.state = 11 /* s_part_data */;

                case 11/* s_part_data */:
                    if (c == CR) {
                        if (this.settings.on_part_data != null)
                            this.settings.on_part_data(buf.substring(mark, i));
                        mark = i;
                        this.state = 12 /* s_part_data_almost_boundary */;
                        this.lookbehind[0] = CR;
                        break;
                    }
                    if (is_last) {
                        if (this.settings.on_part_data != null)
                            this.settings.on_part_data(buf.substring(mark, (i + 1)));
                    }
                    break;

                case 12/* s_part_data_almost_boundary */:
                    if (c == LF) {
                        this.state = 13 /* s_part_data_boundary */;
                        this.lookbehind[1] = LF;
                        this.index = 0;
                        break;
                    }
                    if (this.settings.on_part_data != null)
                        this.settings.on_part_data(this.lookbehind);
                    this.state = 11 /* s_part_data */;
                    mark = i--;
                    break;

                case 13/* s_part_data_boundary */:
                    if (this.multipart_boundary[this.index] != c) {
                        if (this.settings.on_part_data != null)
                            this.settings.on_part_data(this.lookbehind.join("").substring(0, 2 + this.index));
                        this.state = 11 /* s_part_data */;
                        mark = i--;
                        break;
                    }
                    this.lookbehind[2 + this.index] = c;
                    if ((++this.index) == this.boundary_length) {
                        if (this.settings.on_part_data_end != null)
                            this.settings.on_part_data_end();
                        this.state = 14 /* s_part_data_almost_end */;
                    }
                    break;

                case 14/* s_part_data_almost_end */:
                    if (c == '-') {
                        this.state = 16 /* s_part_data_final_hyphen */;
                        break;
                    }
                    if (c == CR) {
                        this.state = 15 /* s_part_data_end */;
                        break;
                    }
                    return i;

                case 16/* s_part_data_final_hyphen */:
                    if (c == '-') {
                        if (this.settings.on_body_end != null)
                            this.settings.on_body_end();
                        this.state = 17 /* s_end */;
                        break;
                    }
                    return i;

                case 15/* s_part_data_end */:
                    if (c == LF) {
                        this.state = 4 /* s_header_field_start */;
                        this.currentHeaders = {};
                        if (this.settings.on_part_data_begin != null)
                            this.settings.on_part_data_begin();
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
};