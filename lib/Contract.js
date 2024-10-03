import { BaseContract, Contract as EthersContract, JsonRpcProvider, } from "ethers";
export default class Contract {
    abi;
    _address;
    _rpcProvider;
    _viewContract;
    get address() {
        if (!this._address)
            throw new Error("Address not initialized");
        return this._address;
    }
    get rpcProvider() {
        if (!this._rpcProvider)
            throw new Error("Provider not initialized");
        return this._rpcProvider;
    }
    get viewContract() {
        if (!this._viewContract)
            throw new Error("Contract not initialized");
        return this._viewContract;
    }
    constructor(abi) {
        this.abi = abi;
    }
    init(rpc, address) {
        this._address = address;
        this._rpcProvider = new JsonRpcProvider(rpc);
        this._viewContract = new BaseContract(address, this.abi, this._rpcProvider);
    }
    async executeAndWait(signer, run) {
        try {
            const contract = new EthersContract(this.address, this.abi, signer);
            const tx = await run(contract);
            const checkReceipt = async () => {
                while (true) {
                    const receipt = await this.rpcProvider.getTransactionReceipt(tx.hash);
                    if (receipt?.blockNumber && receipt.status === 1)
                        return receipt;
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            };
            const receipt = await Promise.race([checkReceipt(), tx.wait()]);
            return { contract, receipt: receipt ?? undefined };
        }
        catch (e) {
            console.error("Transaction failed:", e);
            throw e;
        }
    }
}
//# sourceMappingURL=Contract.js.map