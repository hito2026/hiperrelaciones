import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class HiperrelacionesSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data" / "hyperrelations.json").read_text())
        cls.units = json.loads((ROOT / "data" / "work_units.json").read_text())
        cls.html = (ROOT / "index.html").read_text()
        cls.app = (ROOT / "assets" / "app.js").read_text()

    def test_dataset_has_expected_scope(self):
        self.assertEqual(len(self.data["people"]), 23)
        self.assertEqual(len(self.data["events"]), 118)
        self.assertEqual({event["day"] for event in self.data["events"]}, {"2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14"})
        self.assertIn("10/09 completo", self.data["report"]["coverage"])
        self.assertIn("14/09 hasta 13:55:00", self.data["report"]["coverage"])

    def test_dataset_edges_are_unique_and_resolved(self):
        roster = set(self.data["people"])
        keys = []
        for event in self.data["events"]:
            self.assertIn(event["actor"], roster)
            self.assertIn(event["counterpart"], roster)
            self.assertNotEqual(event["actor"], event["counterpart"])
            keys.append((event["day"], event["time"], event["actor"], event["counterpart"], event["type"], event["reference"], event.get("message_id")))
        self.assertEqual(len(keys), len(set(keys)))

    def test_page_exposes_filters_animation_and_modal(self):
        for identifier in ('id="day"', 'id="person"', 'id="play"', 'id="speed"', 'id="detail"', 'id="productivity"', 'id="formula"', 'id="purpose"', 'id="companyTrace"', 'id="records"', 'id="recordGroup"', 'id="expandRecords"', 'id="collapseRecords"', 'id="matrizRelaciones"', 'id="registros"'):
            self.assertIn(identifier, self.html)
        self.assertIn("showModal()", self.app)
        self.assertIn("prefers-reduced-motion", (ROOT / "assets" / "styles.css").read_text())

    def test_productivity_dataset_and_formula(self):
        metrics = json.loads((ROOT / "data" / "productivity.json").read_text())
        self.assertEqual(set(metrics["days"]), {"2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"})
        self.assertTrue(all(len(rows) == 23 for rows in metrics["days"].values()))
        self.assertAlmostEqual(sum(metrics["methodology"]["weights"].values()), 1)
        self.assertTrue(metrics["sources"]["git_in_outcomes"])
        self.assertEqual(metrics["sources"]["complete_days"], ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13"])
        self.assertEqual(metrics["sources"]["partial_days"], ["2026-09-14"])
        self.assertIn("Math.log1p", self.app)
        self.assertIn("weight=available.reduce", self.app)
        self.assertIn("quality_messages", self.app)
        self.assertIn("hours_attribution_complete", self.app)
        self.assertIn("git_complete", self.app)
        self.assertIn("companyMeasure", self.app)
        self.assertIn("openPurpose", self.app)
        self.assertIn("columnTotals", self.app)
        self.assertIn("grand-total", self.app)

    def test_company_network_uses_unique_directed_pairs(self):
        pairs = {(event["actor"], event["counterpart"]) for event in self.data["events"]}
        summed_personal_networks = sum(len({event["counterpart"] for event in self.data["events"] if event["actor"] == person}) for person in self.data["people"])
        self.assertEqual(len(pairs), summed_personal_networks)
        self.assertIn('new Set(events.map(event=>`${event.actor}\\u0000${event.counterpart}`))', self.app)
        self.assertIn("weighted/weight", self.app)

    def test_records_are_unique_and_timesheets_classified(self):
        records = json.loads((ROOT / "data" / "records.json").read_text())
        comments = [item for item in records["records"] if item["kind"] == "comment"]
        timesheets = [item for item in records["records"] if item["kind"] == "timesheet"]
        commits = [item for item in records["records"] if item["kind"] == "commit"]
        self.assertEqual(len(comments), 97)
        self.assertEqual(len({(item["day"], item["id"]) for item in comments}), 97)
        self.assertEqual(len(timesheets), 101)
        self.assertEqual(len(commits), 53)
        self.assertTrue(all(item["entry_class"] in {"own_entry", "third_party_entry", "zero"} for item in timesheets))
        self.assertIn("filteredRecords", self.app)
        self.assertIn("recordGroup", self.app)
        self.assertIn('index===0)?"open"', self.app)
        self.assertIn('class="record-table"', self.app)
        self.assertIn('class="section-nav"', self.html)
        self.assertIn("methodologyNav", self.html)
        self.assertIn("IntersectionObserver", self.app)
        self.assertIn("data-record-sort", self.app)
        for column in ("Fecha/hora", "Contraparte(s)", "Descripción literal"):
            self.assertIn(column, self.app)
        for removed in ('["change","Anterior → nuevo"]', '["hours","Horas"]', '["created_by","Autor / clasificación"]', '["quality","Q"]', '["coverage","Cobertura"]'):
            self.assertNotIn(removed, self.app)
        self.assertIn("literalTexts", self.app)

    def test_refreshed_records_are_individual_and_unique(self):
        records = json.loads((ROOT / "data" / "records.json").read_text())["records"]
        refreshed = [r for r in records if r["day"] in {"2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"}]
        keys = [(r["kind"], r["id"], r["day"], r["person"], r.get("text")) for r in refreshed]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(len([r for r in refreshed if r["kind"] == "activity" and "tracking" in r["activity_types"]]), 221)
        self.assertEqual(len([r for r in refreshed if r["kind"] == "activity" and "creation" in r["activity_types"]]), 191)

    def test_mass_creation_batch_does_not_inflate_outcomes(self):
        metrics = json.loads((ROOT / "data" / "productivity.json").read_text())
        andres = next(row for row in metrics["days"]["2026-09-11"] if row["person"] == "Andrés Salguero")
        self.assertEqual(andres["coverage"]["batch_creations"], 147)
        self.assertEqual(andres["coverage"]["creations"], 0)
        self.assertEqual(andres["E"], 0)

    def test_work_units_unify_sources_without_losing_evidence(self):
        units = self.units["work_units"]
        task_35183 = [u for u in units if u["person"] == "Carolina Monserrat" and u.get("res_id") == 35183]
        task_32097 = [u for u in units if u["person"] == "Carolina Monserrat" and u.get("res_id") == 32097]
        self.assertEqual(len(task_35183), 1)
        self.assertEqual(len(task_32097), 1)
        self.assertGreaterEqual(len(task_35183[0]["subevents"]), 3)
        self.assertEqual({e["id"] for e in task_32097[0]["subevents"]}, {"T208725", "T208737", "T208738"})
        self.assertEqual(task_35183[0]["source_event_count"], 3)
        self.assertEqual(task_35183[0]["derived_event_count"], 2)

    def test_andres_batch_is_one_unit_with_147_source_events(self):
        batches = [u for u in self.units["work_units"] if u["person"] == "Andrés Salguero" and u.get("batch") and "147 tareas creadas" in u["title"]]
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["source_event_count"], 147)
        self.assertEqual(len(batches[0]["subevents"]), 147)
        self.assertEqual(len(set(batches[0]["batch_ids"])), 147)

    def test_distinct_tasks_only_merge_in_proven_batches(self):
        for unit in self.units["work_units"]:
            ids = {e.get("work_res_id") or e.get("res_id") for e in unit["subevents"] if (e.get("work_model") or e.get("model")) in {"project.task", "helpdesk.ticket"}}
            if len(ids) > 1:
                self.assertTrue(unit.get("batch"), unit["key"])

    def test_odoo_links_are_safe_and_work_units_are_loaded(self):
        self.assertIn("data/work_units.json", self.app)
        self.assertIn("https://www.hitofusion.com/web#id=", self.app)
        self.assertIn('target="_blank" rel="noopener noreferrer"', self.app)
        self.assertIn("source_event_count", self.app)


if __name__ == "__main__":
    unittest.main()
