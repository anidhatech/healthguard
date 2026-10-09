# Recorded AI fixtures

The demo provider looks for `fixtures/<TASK>/<inputHash>.json` before falling
back to its deterministic template composer. A fixture is a model output that
a person recorded and reviewed, keyed by the hash of task + prompt version +
fact sheet + clinician instruction, so it is only ever replayed for exactly
the same input.

Fixtures must validate against the task's zod schema and pass the same
safety validators as live output. None are committed yet: the template
composer covers the demo scenario.
