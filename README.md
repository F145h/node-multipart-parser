# node-multipart-parser
node-multipart-parser - Simple and lightweight multipart/form-data parser Implementation based  on miltipart-parser-c by iafonov


How parse data:

```js
let multipart_parser = require("../index.js")


function read_header_name(name) {
    console.log("[read_header_name: " + name + "]");
}

function read_header_value(value) {
    console.log("[read_header_value: " + value + "]");
}

function part_data_begin() {
    console.log("[part_data_begin]");
}

function headers_complete(contentName, headers) {
    console.log("[headers_complete: " + contentName + "]");
    console.log(headers);
}

function part_data_end() {
    console.log("[part_data_end]");
}

function body_end() {
    console.log("[body_end]");
}

function read_data(data) {
    console.log("read_data: " + data);
}

var callbacks = {};
callbacks.on_header_field = read_header_name;
callbacks.on_header_value = read_header_value;
callbacks.on_part_data = read_data;
callbacks.on_part_data_begin = part_data_begin;
callbacks.on_headers_complete = headers_complete;
callbacks.on_part_data_end = part_data_end;
callbacks.on_body_end = body_end;

var boundary = "--Asrf456BGe4h";
var parser = new multipart_parser(boundary, callbacks);

parser.execute("--Asrf456BGe4h\x0d\x0a");
parser.execute("Content-Disposition: form-data; name=\"DestAddress\"\x0d\x0a");
parser.execute("\x0d\x0abrutal-vasya@example.com\x0d\x0a--Asrf456BGe4h\x0d\x0aContent-Disposition: form-data; name=\"MessageComment\"\x0d\x0a");
parser.execute("\x0d\x0a\x0d\x0a--Asrf45");
parser.execute("6BGe4h\x0d\x0aContent-");
parsewr.execute("Disposition: form-");
parser.execute("data; name=\"MessageTitle\"\x0d\x0a\Header-Value: \x0d\x0aContent-Type: text/plain\x0d\x0a\x0d\x0aHello\x0d");
parser.execute("\x0a--Asrf456BGe4h--\x0d\x0a\x0d\x0a");
```
