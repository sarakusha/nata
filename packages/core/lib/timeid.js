"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = timeid;

require("source-map-support/register");

let lastTimeid;

function timeid() {
  const time = Date.now();
  const last = lastTimeid || time;
  return (lastTimeid = time > last ? time : last + 1).toString(36);
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy90aW1laWQudHMiXSwibmFtZXMiOlsibGFzdFRpbWVpZCIsInRpbWVpZCIsInRpbWUiLCJEYXRlIiwibm93IiwibGFzdCIsInRvU3RyaW5nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxJQUFJQSxVQUFKOztBQUVlLFNBQVNDLE1BQVQsR0FBMEI7QUFDdkMsUUFBTUMsSUFBSSxHQUFHQyxJQUFJLENBQUNDLEdBQUwsRUFBYjtBQUNBLFFBQU1DLElBQUksR0FBR0wsVUFBVSxJQUFJRSxJQUEzQjtBQUNBLFNBQU8sQ0FBQ0YsVUFBVSxHQUFHRSxJQUFJLEdBQUdHLElBQVAsR0FBY0gsSUFBZCxHQUFxQkcsSUFBSSxHQUFHLENBQTFDLEVBQTZDQyxRQUE3QyxDQUFzRCxFQUF0RCxDQUFQO0FBQ0QiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgbGFzdFRpbWVpZDogbnVtYmVyO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiB0aW1laWQoKTogc3RyaW5nIHtcbiAgY29uc3QgdGltZSA9IERhdGUubm93KCk7XG4gIGNvbnN0IGxhc3QgPSBsYXN0VGltZWlkIHx8IHRpbWU7XG4gIHJldHVybiAobGFzdFRpbWVpZCA9IHRpbWUgPiBsYXN0ID8gdGltZSA6IGxhc3QgKyAxKS50b1N0cmluZygzNik7XG59XG4iXX0=