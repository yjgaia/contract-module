import {
  BaseContract,
  JsonRpcProvider,
  JsonRpcSigner,
  TopicFilter,
  ZeroAddress,
} from "https://esm.sh/ethers@6.7.0";
import {
  Context,
  response,
} from "https://raw.githubusercontent.com/yjgaia/deno-module/refs/heads/main/api.ts";
import {
  safeFetch,
  safeStore,
} from "https://raw.githubusercontent.com/yjgaia/supabase-module/refs/heads/main/deno/supabase.ts";
import { TypedDeferredTopicFilter, TypedEventLog } from "./abi/common.ts";

export abstract class Contract<CT extends BaseContract = BaseContract> {
  protected abstract ethersContract: CT;
  protected abstract eventFilters: {
    [eventName: string]: TypedDeferredTopicFilter<any>;
  };

  public eventTopicFilters: { [event: string]: TopicFilter } = {};

  constructor(protected signer: JsonRpcSigner, protected address: string) {}

  public async getEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<TypedEventLog<any>[]> {
    if (Object.keys(this.eventTopicFilters).length === 0) {
      for (const eventName of Object.keys(this.eventFilters)) {
        this.eventTopicFilters[eventName] = await this.eventFilters[eventName]
          .getTopicFilter();
      }
    }

    return await this.ethersContract.queryFilter(
      [Object.values(this.eventTopicFilters).flat()] as any,
      fromBlock,
      toBlock,
    ) as any;
  }
}

export function serveContractApi(
  rpcs: { [chain: string]: string },
  Contracts: {
    [contract: string]: new (
      signer: JsonRpcSigner,
      address: string,
    ) => Contract;
  },
  contractAddresses: { [contract: string]: { [chain: string]: string } },
  contractDeployedBlocks: { [contract: string]: number },
) {
  return async function (context: Context) {
    const url = new URL(context.request.url);
    const uri = url.pathname.replace("/api/contract/", "");

    if (uri === "track-events") {
      let { chain, contract: contractName, blockPeriod } = await context.request
        .json();
      if (contractName === undefined) throw new Error("Missing contract");
      if (!blockPeriod) {
        if (chain === "base" || chain === "base-sepolia") blockPeriod = 500;
        else if (chain === "arbitrum") blockPeriod = 2500;
        else blockPeriod = 750;
      }

      const provider = new JsonRpcProvider(rpcs[chain]);
      const signer = new JsonRpcSigner(provider, ZeroAddress);
      const address = contractAddresses[contractName][chain];
      const contract = new Contracts[contractName](signer, address);

      const data = await safeFetch<{ block: number }>(
        "contract_event_tracked_blocks",
        (b) => b.select().eq("chain", chain).eq("contract", contract).single(),
      );

      let toBlock =
        (data?.block ?? (contractDeployedBlocks[contractName] ?? 0)) +
        blockPeriod;

      const currentBlock = await provider.getBlockNumber();
      if (toBlock > currentBlock) toBlock = currentBlock;
      const fromBlock = toBlock - blockPeriod * 2;

      const savedEvents = await safeFetch<
        { chain: string; contract: string; block: number; log_index: number }[]
      >("contract_events", (b) =>
        b.select("chain, contract, block, log_index")
          .eq("chain", chain)
          .eq("contract", contract)
          .order("created_at", { ascending: false }));

      const events = await contract.getEvents(fromBlock, toBlock);
      for (const event of events) {
        const eventName = Object.keys(contract.eventTopicFilters).find((key) =>
          contract.eventTopicFilters[key][0] === event.topics[0]
        );
        const args = event.args.map((arg) => arg.toString());

        const data = {
          chain,
          contract: contractName,
          block: event.blockNumber,
          log_index: event.index,
          tx: event.transactionHash,
          event: eventName,
          args,
        };

        if (
          !savedEvents.find((savedEvent) =>
            savedEvent.chain === data.chain &&
            savedEvent.contract === data.contract &&
            savedEvent.block === data.block &&
            savedEvent.log_index === data.log_index
          )
        ) {
          await safeStore("contract_events", (b) => b.upsert(data));
        }
      }

      await safeStore("contract_event_tracked_blocks", (b) =>
        b.insert({
          chain,
          contract: contractName,
          block: toBlock,
          updated_at: new Date().toISOString(),
        }));

      context.response = response("ok");
    }

    if (uri === "test") {
      context.response = response("ok");
    }
  };
}
