import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

const schemaPath = resolve(process.cwd(), "supabase", "schema.sql");

const requiredSchemaMarkers = [
	"create unique index if not exists lobby_punishments_single_active_week_idx",
	"create or replace function enforce_lobby_spin_event_integrity()",
	"create trigger trg_lobby_spin_event_integrity",
	"create or replace function enforce_week_ready_state_integrity()",
	"create trigger trg_week_ready_state_integrity",
	"create or replace function enforce_commentary_event_state_machine()",
	"create trigger trg_commentary_event_state_machine",
	"create policy activity_votes_insert_self on activity_votes",
	"create policy comments_read_member on comments",
	"create policy commentary_emitted_read_member on commentary_emitted",
	"create policy lobby_spin_events_member_read on lobby_spin_events",
];

test("schema contains critical invariants and safety policies", async () => {
	const sql = await readFile(schemaPath, "utf8");
	for (const marker of requiredSchemaMarkers) {
		assert.equal(
			sql.toLowerCase().includes(marker.toLowerCase()),
			true,
			`missing schema marker: ${marker}`
		);
	}
});

test("optional live schema smoke: critical tables are reachable when service-role env is configured", async (t) => {
	const url = process.env.MIGRATION_SMOKE_SUPABASE_URL;
	const serviceRoleKey = process.env.MIGRATION_SMOKE_SERVICE_ROLE_KEY;
	if (!url || !serviceRoleKey) {
		t.skip("MIGRATION_SMOKE_SUPABASE_URL and MIGRATION_SMOKE_SERVICE_ROLE_KEY are not set");
		return;
	}

	const supabase = createClient(url, serviceRoleKey, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	for (const table of ["commentary_events", "commentary_rule_runs", "lobby_punishments", "lobby_spin_events"]) {
		const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(1);
		assert.equal(error, null, `table check failed for ${table}: ${error?.message || "unknown error"}`);
	}
});
