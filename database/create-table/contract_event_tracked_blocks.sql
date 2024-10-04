CREATE TABLE IF NOT EXISTS "public"."contract_event_tracked_blocks" (
    "chain" text NOT NULL,
    "contract" text NOT NULL,
    "block" bigint NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."contract_event_tracked_blocks" OWNER TO "postgres";

ALTER TABLE ONLY "public"."contract_event_tracked_blocks"
    ADD CONSTRAINT "contract_event_tracked_blocks_pkey" PRIMARY KEY ("chain", "contract");

ALTER TABLE "public"."contract_event_tracked_blocks" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."contract_event_tracked_blocks" TO "anon";
GRANT ALL ON TABLE "public"."contract_event_tracked_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_event_tracked_blocks" TO "service_role";
