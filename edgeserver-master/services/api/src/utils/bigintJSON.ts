declare global {
    interface BigInt {
        toJSON(): string;
    }
}

BigInt.prototype.toJSON = function () {
    return this.toString();
};

export const polyfillBigInt = () => {
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
};