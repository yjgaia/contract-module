import {
  JsonRpcProvider,
  JsonRpcSigner,
  TopicFilter,
  ZeroAddress,
} from "https://esm.sh/ethers@6.7.0";
import {
  Context,
  response,
} from "https://raw.githubusercontent.com/yjgaia/deno-module/main/api.ts";
import {
  safeFetch,
  safeInsert,
  safeUpsert,
} from "https://raw.githubusercontent.com/yjgaia/supabase-module/refs/heads/main/supabase/functions-module/supabase.ts";
import { TypedEventLog } from "./abi/common.ts";

export abstract class Contract {
  constructor(protected signer: JsonRpcSigner) {}

  public abstract getEvents(
    fromBlock: number,
    toBlock: number,
  ): Promise<TypedEventLog<any>[]>;

  public abstract eventTopicFilters: { [event: string]: TopicFilter };
}

export function serveContractApi(
  rpcs: { [chain: string]: string },
  Contracts: { [contract: string]: new (signer: JsonRpcSigner) => Contract },
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
        if (chain === "base") blockPeriod = 500;
        else if (chain === "arbitrum") blockPeriod = 2500;
        else blockPeriod = 750;
      }

      const provider = new JsonRpcProvider(rpcs[chain]);
      const signer = new JsonRpcSigner(provider, ZeroAddress);
      const contract = new Contracts[contractName](signer);

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
          await safeUpsert("contract_events", data);
        }
      }

      await safeInsert("contract_event_tracked_blocks", {
        chain,
        contract: contractName,
        block: toBlock,
        updated_at: new Date().toISOString(),
      });

      context.response = response("ok");
    }

    if (uri === "test") {
      context.response = response("ok");
    }
  };
}
