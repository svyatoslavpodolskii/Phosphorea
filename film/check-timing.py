"""Verify scene cuts and shared interaction cues against actual score onsets."""
import json
from pathlib import Path

root = Path(__file__).parent
timeline = json.loads((root / 'timeline.json').read_text(encoding='utf-8'))
score = json.loads((root / 'output/music-events.json').read_text(encoding='utf-8'))
foley = json.loads((root / 'cue-sheet.json').read_text(encoding='utf-8'))['foley']
onsets = [event['time'] for event in score]
cursor = 0
checks = []
for shot in timeline['shots']:
    start = round(cursor, 6)
    cursor += shot['duration']
    assert abs(start - shot['start']) < 1e-6, shot['id']
    if shot['id'] == '25_silence':
        break
    if start >= 9.6:
        assert abs(start / timeline['bar'] - round(start / timeline['bar'])) < 1e-6, shot['id']
        assert min(abs(start - onset) for onset in onsets) < 1e-6, ('Unscored cut', shot['id'])
        checks.append({'scene': shot['id'], 'time': start, 'frame': round(start * timeline['fps'])})
    if shot['module'] == 'title':
        assert shot['duration'] == 1.2, ('Unreadable title', shot['id'])
    for name, value in shot.get('events', {}).items():
        for offset in value if isinstance(value, list) else [value]:
            at = round(start + offset, 6)
            assert 0 <= offset < shot['duration'], (shot['id'], name)
            if name == 'typing':
                assert any(abs(event['time'] - at) < 1e-6 for event in foley), ('Silent keystroke', shot['id'])
            else:
                assert min(abs(at - onset) for onset in onsets) < 1e-6, ('Unscored action', shot['id'], name)
            checks.append({'scene': shot['id'], 'event': name, 'time': at, 'frame': round(at * timeline['fps'])})
kanban = next(s for s in timeline['shots'] if s['id'] == '12_kanban')
move = kanban['start'] + kanban['events']['move']
assert any(abs(event['time'] - move) < 1e-6 and event['kind'] == 'air' for event in foley)
assert not any(abs(event['time'] - move) < 1e-6 and event['kind'] == 'tick' for event in foley)
(root / 'output/timing-check.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
print(f'{len(checks)} cuts and action cues align with score onsets; titles and movement sound verified.')
