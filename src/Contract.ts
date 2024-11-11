import {
  BaseContract,
  Contract as EthersContract,
  ContractTransactionResponse,
  Interface,
  InterfaceAbi,
  JsonRpcProvider,
  JsonRpcSigner,
  TransactionReceipt,
} from "ethers";

export default abstract class Contract<CT extends BaseContract> {
  private _address: string | undefined;
  private _rpcProvider: JsonRpcProvider | undefined;
  private _viewContract: CT | undefined;

  private get address(): string {
    if (!this._address) throw new Error("Address not initialized");
    return this._address;
  }

  private get rpcProvider(): JsonRpcProvider {
    if (!this._rpcProvider) throw new Error("Provider not initialized");
    return this._rpcProvider;
  }

  protected get viewContract(): CT {
    if (!this._viewContract) throw new Error("Contract not initialized");
    return this._viewContract;
  }

  constructor(private abi: Interface | InterfaceAbi) {}

  public init(rpc: string, address: string) {
    this._address = address;
    this._rpcProvider = new JsonRpcProvider(rpc);
    this._viewContract = new BaseContract(
      address,
      this.abi,
      this._rpcProvider,
    ) as CT;
  }

  protected async executeAndWait(
    signer: JsonRpcSigner,
    run: (contract: CT) => Promise<ContractTransactionResponse>,
  ): Promise<{ contract: CT; receipt: TransactionReceipt | undefined }> {
    try {
      const contract: CT = new EthersContract(
        this.address,
        this.abi,
        signer,
      ) as any;

      const tx = await run(contract);

      const checkReceipt = async () => {
        while (true) {
          const receipt = await this.rpcProvider.getTransactionReceipt(tx.hash);
          if (receipt?.blockNumber && receipt.status === 1) return receipt;
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      };

      const receipt = await Promise.race([checkReceipt(), tx.wait()]);
      return { contract, receipt: receipt ?? undefined };
    } catch (e: any) {
      console.error("Transaction failed:", e);
      throw e;
    }
  }
}
