/// <reference types="node" />
import { EventEmitter } from 'events';
import Address, { AddressParam } from '../Address';
import { IDevice } from '../mib';
import { NibusConnection } from '../nibus';
import { Category } from './KnownPorts';
export declare const delay: (seconds: number) => Promise<void>;
export declare type FoundListener = (arg: {
    connection: NibusConnection;
    category: Category;
    address: Address;
}) => void;
export declare type ConnectionListener = (connection: NibusConnection) => void;
export declare type DeviceListener = (device: IDevice) => void;
declare interface NibusSession {
    on(event: 'start' | 'close', listener: () => void): this;
    on(event: 'found', listener: FoundListener): this;
    on(event: 'add' | 'remove', listener: ConnectionListener): this;
    on(event: 'connected' | 'disconnected', listener: DeviceListener): this;
    on(event: 'pureConnection', listener: (connection: NibusConnection) => void): this;
    once(event: 'start' | 'close', listener: () => void): this;
    once(event: 'found', listener: FoundListener): this;
    once(event: 'add' | 'remove', listener: ConnectionListener): this;
    once(event: 'connected' | 'disconnected', listener: DeviceListener): this;
    once(event: 'pureConnection', listener: (connection: NibusConnection) => void): this;
    off(event: 'start' | 'close', listener: () => void): this;
    off(event: 'found', listener: FoundListener): this;
    off(event: 'add' | 'remove', listener: ConnectionListener): this;
    off(event: 'connected' | 'disconnected', listener: DeviceListener): this;
    off(event: 'pureConnection', listener: (connection: NibusConnection) => void): this;
    removeListener(event: 'start' | 'close', listener: () => void): this;
    removeListener(event: 'found', listener: FoundListener): this;
    removeListener(event: 'add' | 'remove', listener: ConnectionListener): this;
    removeListener(event: 'connected' | 'disconnected', listener: DeviceListener): this;
    removeListener(event: 'pureConnection', listener: (connection: NibusConnection) => void): this;
}
declare class NibusSession extends EventEmitter {
    private readonly connections;
    private isStarted;
    private socket?;
    get ports(): number;
    start(): Promise<number>;
    connectDevice(device: IDevice, connection: NibusConnection): void;
    close(): void;
    pingDevice(device: IDevice): Promise<number>;
    ping(address: AddressParam): Promise<number>;
    private reloadHandler;
    private addHandler;
    private closeConnection;
    private removeHandler;
    private find;
}
declare const session: NibusSession;
export default session;
//# sourceMappingURL=session.d.ts.map