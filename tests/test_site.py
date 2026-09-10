import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class HiperrelacionesSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((ROOT / "data" / "hyperrelations.json").read_text())
        cls.html = (ROOT / "index.html").read_text()
        cls.app = (ROOT / "assets" / "app.js").read_text()

    def test_dataset_has_expected_scope(self):
        self.assertEqual(len(self.data["people"]), 23)
        self.assertEqual(len(self.data["events"]), 92)
        self.assertEqual({event["day"] for event in self.data["events"]}, {"2026-09-09", "2026-09-10"})

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
        for identifier in ('id="day"', 'id="person"', 'id="play"', 'id="speed"', 'id="detail"', 'id="productivity"', 'id="formula"', 'id="purpose"', 'id="companyTrace"'):
            self.assertIn(identifier, self.html)
        self.assertIn("showModal()", self.app)
        self.assertIn("prefers-reduced-motion", (ROOT / "assets" / "styles.css").read_text())

    def test_productivity_dataset_and_formula(self):
        metrics = json.loads((ROOT / "data" / "productivity.json").read_text())
        self.assertEqual(set(metrics["days"]), {"2026-09-09", "2026-09-10"})
        self.assertTrue(all(len(rows) == 23 for rows in metrics["days"].values()))
        self.assertAlmostEqual(sum(metrics["methodology"]["weights"].values()), 1)
        self.assertIn("Math.log1p", self.app)
        self.assertIn("weight=available.reduce", self.app)
        self.assertIn("quality_messages", self.app)
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


if __name__ == "__main__":
    unittest.main()
