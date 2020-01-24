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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_log_1 = __importDefault(require("electron-log"));
const events_1 = require("events");
const Either_1 = require("fp-ts/lib/Either");
const fs_1 = __importDefault(require("fs"));
const PathReporter_1 = require("io-ts/lib/PathReporter");
const js_yaml_1 = __importDefault(require("js-yaml"));
const lodash_1 = __importDefault(require("lodash"));
const path_1 = __importDefault(require("path"));
const serialport_1 = __importDefault(require("serialport"));
const usb_detection_1 = __importDefault(require("usb-detection"));
const core_1 = require("@nibus/core");
const static_1 = __importDefault(require("./static"));
electron_log_1.default.transports.file.level = 'info';
electron_log_1.default.transports.console.level = false;
function getOrUndefined(e) {
    return Either_1.getOrElse(() => undefined)(e);
}
const debug = electron_log_1.default.info.bind(electron_log_1.default);
const detectionPath = path_1.default.resolve(__dirname, '../../detection.yml');
let knownPorts = Promise.resolve([]);
electron_log_1.default.info('DETECTOR', detectionPath);
const getRawDetection = () => {
    try {
        const data = fs_1.default.readFileSync(detectionPath, 'utf8');
        return js_yaml_1.default.safeLoad(data);
    }
    catch (err) {
        debug(`Warning: failed to read file ${detectionPath} (${err.message})`);
        return static_1.default;
    }
};
const loadDetection = () => {
    const result = getRawDetection();
    Object.keys(result.mibCategories).forEach(category => {
        const desc = result.mibCategories[category];
        desc.category = category;
        if (Array.isArray(desc.select)) {
            desc.select = desc.select
                .map(cat => result.mibCategories[cat] || cat);
        }
    });
    return result;
};
let detection = loadDetection();
function reloadDevices(lastAdded) {
    knownPorts = knownPorts.then(ports => reloadDevicesAsync(ports, lastAdded));
}
const reload = lodash_1.default.debounce(reloadDevices, 2000);
const detectionListener = (curr, prev) => {
    if (curr.mtime !== prev.mtime) {
        debug('detection file was changed, reloading devices...');
        detection = undefined;
        reloadDevices();
    }
};
const detector = new events_1.EventEmitter();
detector.start = () => {
    usb_detection_1.default.startMonitoring();
    debug(`start watching the detector file ${detectionPath}`);
    fs_1.default.watchFile(detectionPath, { persistent: false }, detectionListener);
    reloadDevices();
    usb_detection_1.default.on('add', reload);
    usb_detection_1.default.on('remove', reloadDevices);
};
detector.stop = () => {
    fs_1.default.unwatchFile(detectionPath, detectionListener);
    usb_detection_1.default && usb_detection_1.default.stopMonitoring();
};
detector.restart = () => {
    if (!usb_detection_1.default) {
        detector.start();
        return;
    }
    usb_detection_1.default.stopMonitoring();
    process.nextTick(() => usb_detection_1.default.startMonitoring());
};
detector.getPorts = () => knownPorts;
detector.getDetection = () => detection;
const getId = (id) => (typeof id === 'string'
    ? parseInt(id, 16)
    : id);
function equals(port, device) {
    return getId(port.productId) === device.productId
        && getId(port.vendorId) === device.vendorId
        && port.serialNumber === device.serialNumber;
}
function detectDevice(port, lastAdded) {
    return __awaiter(this, void 0, void 0, function* () {
        let detected;
        if (lastAdded && equals(port, lastAdded)) {
            detected = lastAdded;
        }
        else {
            let list = yield usb_detection_1.default.find(getId(port.vendorId), getId(port.productId), () => { });
            const { serialNumber, manufacturer } = port;
            list = lodash_1.default.filter(list, {
                serialNumber,
                manufacturer,
            });
            if (list.length === 0) {
                debug(`Unknown device ${JSON.stringify(port)}`);
            }
            else if (list.length > 1) {
                debug(`can't identify device ${JSON.stringify(port)}`);
            }
            else {
                [detected] = list;
            }
        }
        if (detected !== undefined) {
            const { productId, vendorId, deviceName: device, deviceAddress, } = detected;
            return Object.assign(Object.assign({}, port), { productId,
                vendorId,
                device,
                deviceAddress });
        }
        return Object.assign(Object.assign({}, port), { productId: getId(port.productId), vendorId: getId(port.vendorId) });
    });
}
const matchCategory = (port) => {
    const match = detection && lodash_1.default.find(detection.knownDevices, item => (!item.device || (port.device && port.device.startsWith(item.device)))
        && (!item.serialNumber
            || (port.serialNumber && port.serialNumber.startsWith(item.serialNumber)))
        && (!item.manufacturer || (port.manufacturer === item.manufacturer))
        && (getId(item.vid) === port.vendorId) && (getId(item.pid) === port.productId));
    if (!match && process.platform === 'win32'
        && (port.productId === 0x6001 || port.productId === 0x6015)
        && port.vendorId === 0x0403) {
        return 'ftdi';
    }
    return match && getOrUndefined(core_1.CategoryV.decode(match.category));
};
function reloadDevicesAsync(prevPorts, lastAdded) {
    return __awaiter(this, void 0, void 0, function* () {
        const ports = [];
        try {
            if (detection == null) {
                detection = loadDetection();
            }
            const list = yield serialport_1.default.list();
            const externalPorts = list.filter(port => !!port.productId);
            yield externalPorts.reduce((promise, port) => __awaiter(this, void 0, void 0, function* () {
                const nextPorts = yield promise;
                const prev = lodash_1.default.findIndex(prevPorts, { path: port.path });
                let device;
                if (prev !== -1) {
                    [device] = prevPorts.splice(prev, 1);
                    const category = matchCategory(device);
                    if (category !== device.category) {
                        debug(`device's category was changed ${device.category} to ${category}`);
                        device.category && detector.emit('remove', device);
                        device.category = getOrUndefined(core_1.CategoryV.decode(category));
                        device.category && detector.emit('add', device);
                    }
                }
                else {
                    device = yield detectDevice(port, lastAdded);
                    device.category = matchCategory(device);
                    detector.emit('plug', device);
                    if (device.category) {
                        debug(`new device ${device.device || device.vendorId}/\
${device.category} was plugged to ${device.path}`);
                        detector.emit('add', device);
                    }
                    else {
                        debug('unknown device %o was plugged', device);
                    }
                }
                const validation = core_1.KnownPortV.decode(device);
                if (Either_1.isLeft(validation)) {
                    debug('<error>', PathReporter_1.PathReporter.report(validation).join('\n'));
                }
                else {
                    nextPorts.push(validation.right);
                }
                return nextPorts;
            }), Promise.resolve(ports));
            prevPorts.forEach(port => {
                detector.emit('unplug', port);
                debug(`device ${port.device || port.vendorId}/\
${port.category || port.productId} was unplugged from ${port.path}`);
                port.category && detector.emit('remove', port);
            });
            return ports;
        }
        catch (err) {
            debug(`Error: reload devices was failed (${err.stack || err})`);
            return ports;
        }
    });
}
exports.default = detector;
//# sourceMappingURL=detector.js.map