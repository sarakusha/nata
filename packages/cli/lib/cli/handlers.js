"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = __importStar(require("@nibus/core"));
const serviceWrapper_1 = __importDefault(require("./serviceWrapper"));
function makeAddressHandler(action, breakout = false) {
    return serviceWrapper_1.default((args) => __awaiter(this, void 0, void 0, function* () {
        let count = (yield core_1.default.start()) * (process.platform === 'win32' ? 3 : 1);
        return new Promise((resolve, reject) => {
            let timeout;
            let hasFound = false;
            const close = (err) => {
                clearTimeout(timeout);
                core_1.default.close();
                if (err || !hasFound) {
                    reject(err || 'Устройство не найдено');
                    return;
                }
                resolve();
            };
            const mac = new core_1.Address(args.mac);
            if (args.timeout && args.timeout !== core_1.config.timeout * 1000) {
                core_1.config.timeout = args.timeout * 1000;
            }
            const perform = (connection, mibOrType, version) => __awaiter(this, void 0, void 0, function* () {
                clearTimeout(timeout);
                const device = core_1.devices.create(mac, mibOrType, version);
                device.connection = connection;
                yield action(device, args);
                hasFound = true;
            });
            const wait = () => {
                count -= 1;
                if (count > 0) {
                    timeout = setTimeout(wait, core_1.config.timeout);
                }
                else {
                    close();
                }
            };
            core_1.default.on('found', ({ address, connection }) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (address.equals(mac) && connection.description.mib) {
                        if (!args.mib || args.mib === connection.description.mib) {
                            yield perform(connection, connection.description.mib);
                            if (breakout) {
                                close();
                                return;
                            }
                            wait();
                        }
                    }
                    if ((address.equals(mac) && connection.description.type)
                        || connection.description.link) {
                        count += 1;
                        const [version, type] = yield connection.getVersion(mac);
                        if (type) {
                            yield perform(connection, type, version);
                            if (breakout) {
                                close();
                                return;
                            }
                            wait();
                        }
                    }
                }
                catch (e) {
                    close(e.message || e);
                }
                count -= 1;
                if (count === 0) {
                    clearTimeout(timeout);
                    process.nextTick(close);
                }
            }));
            timeout = setTimeout(wait, core_1.config.timeout);
        });
    }));
}
exports.default = makeAddressHandler;
//# sourceMappingURL=handlers.js.map