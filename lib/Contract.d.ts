import { BaseContract, ContractTransactionResponse, Interface, InterfaceAbi, JsonRpcSigner, TransactionReceipt } from "ethers";
export default abstract class Contract<CT extends BaseContract> {
    private abi;
    private _address;
    private _rpcProvider;
    private _viewContract;
    private get address();
    private get rpcProvider();
    private get viewContract();
    constructor(abi: Interface | InterfaceAbi);
    init(rpc: string, address: string): void;
    protected executeAndWait(signer: JsonRpcSigner, run: (contract: CT) => Promise<ContractTransactionResponse>): Promise<{
        contract: CT;
        receipt: TransactionReceipt | undefined;
    }>;
}
//# sourceMappingURL=Contract.d.ts.map