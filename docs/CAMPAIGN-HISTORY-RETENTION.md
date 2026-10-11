# Campaign history retention

Current campaign records, approved Markdown memory, content/playbook/notes files, terrain references and active agent undo snapshots are never pruned by history cleanup. Campaign saves keep the newest note revision even if it alone exceeds the historical budget; older note revisions are capped at 50 entries and a 2 MiB serialized budget. This prevents duplicate large note snapshots from eventually blocking otherwise valid campaign saves.

Recognized historical files are pruned oldest first, by modification time:

| History | File ceiling | Byte ceiling | Protection |
| --- | ---: | ---: | --- |
| Archived conversation messages | 10,000 | 32 MiB | Current chat and chat referenced by active agent undo snapshots |
| Old Markdown document contents | 250 | 32 MiB | Previous contents required by active agent undo, plus the just-written document's undo contents |
| Generated Markdown memory versions | 64 | 32 MiB | Newest eight versions of each memory document |

Protected files take precedence over ceilings; cleanup reports `protectedOverflow:true` rather than removing them. Unrecognized files, subdirectories, symlinks and junctions are never deleted. A malformed or missing active undo snapshot prevents cleanup. Campaign saves and document writes remain successful if optional cleanup fails. `retainCampaignHistory` and the file service's `prune` method return counts and overflow information for diagnostics. This policy bounds ordinary history; it does not promise to delete user-created files or override undo protection to meet a disk quota.

Cleanup runs after durable campaign saves and document writes. It scans at most 20,000 directory entries per category; larger directories are reported as `scanLimitReached` and retained for manual inspection. Archive deletion is permanent, so export a portable campaign before starting a campaign whose entire conversation must be preserved beyond the retention ceiling. Current agreed content remains in the campaign and Markdown memory; retaining conversational history is separate from retaining approved campaign facts. No model or paid request is used for this cleanup.
