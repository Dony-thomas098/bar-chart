import { saveChart, createFolder, cacheLyric, cacheFolder } from './storage';
import { supabase } from './supabase';
import { Chart } from './storage';

export async function seedSampleData(overrideUserId?: string) {
  let userId = overrideUserId || '';
  if (!userId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id || (typeof window !== 'undefined' ? localStorage.getItem('chord-grid-offline-user-id') || 'sample-user' : 'sample-user');
    } catch {
      userId = 'sample-user';
    }
  }

  const now = new Date().toISOString();

  // ─── 1. FOLDERS ──────────────────────────────────────────────────────────
  const worshipFolder = await createFolder(null, 'Worship & Praise', 'chart');
  const jazzFolder = await createFolder(null, 'Jazz & Standards', 'chart');
  const popFolder = await createFolder(null, 'Acoustic & Pop Classics', 'chart');
  const lyricsFolder = await createFolder(null, 'Worship Lyrics Sheet', 'lyrics');

  // ─── 2. CHARTS ───────────────────────────────────────────────────────────

  // Chart 1: Way Maker (Worship Folder)
  const wayMaker: Chart = {
    id: crypto.randomUUID(),
    title: 'Way Maker',
    tempo: 68,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: worshipFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Intro',
        labelColor: '#6366f1',
        blocks: [
          { id: crypto.randomUUID(), bars: ['E', 'B', 'C#m', 'A'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Verse 1',
        labelColor: '#3b82f6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['E', 'B', 'C#m', 'A'] },
          { id: crypto.randomUUID(), bars: ['E', 'B', 'C#m', 'A'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Chorus',
        labelColor: '#10b981',
        blocks: [
          { id: crypto.randomUUID(), bars: ['E', 'B', 'C#m', 'A'], startRepeat: true, endRepeat: true }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Bridge',
        labelColor: '#ec4899',
        blocks: [
          { id: crypto.randomUUID(), bars: ['E', 'B', 'C#m7', 'Amaj7'] }
        ]
      }
    ]
  };

  // Chart 2: Goodness of God (Worship Folder)
  const goodnessOfGod: Chart = {
    id: crypto.randomUUID(),
    title: 'Goodness of God',
    tempo: 70,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: worshipFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Verse 1',
        labelColor: '#3b82f6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['G', 'C', 'G', 'D'] },
          { id: crypto.randomUUID(), bars: ['Em', 'C', 'D', 'G'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Chorus',
        labelColor: '#10b981',
        blocks: [
          { id: crypto.randomUUID(), bars: ['C', 'G', 'C', 'G  D'] },
          { id: crypto.randomUUID(), bars: ['C', 'Em', 'C  D', 'G'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Bridge',
        labelColor: '#ec4899',
        blocks: [
          { id: crypto.randomUUID(), bars: ['G/B  C', 'D  G', 'G/B  C', 'D  Em'] }
        ]
      }
    ]
  };

  // Chart 3: Autumn Leaves (Jazz Folder)
  const autumnLeaves: Chart = {
    id: crypto.randomUUID(),
    title: 'Autumn Leaves',
    tempo: 120,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: jazzFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'A Section',
        labelColor: '#8b5cf6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['Am7', 'D7', 'Gmaj7', 'Cmaj7'] },
          { id: crypto.randomUUID(), bars: ['F#m7b5', 'B7', 'Em7', 'Em7'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'B Section',
        labelColor: '#f59e0b',
        blocks: [
          { id: crypto.randomUUID(), bars: ['F#m7b5', 'B7b9', 'Em7', 'Em7'] },
          { id: crypto.randomUUID(), bars: ['Am7', 'D7', 'Gmaj7', 'Cmaj7'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Coda',
        labelColor: '#ef4444',
        blocks: [
          { id: crypto.randomUUID(), bars: ['F#m7b5', 'B7b9', 'Em7  Eb7', 'Dm7  G7'] }
        ]
      }
    ]
  };

  // Chart 4: Fly Me To The Moon (Jazz Folder)
  const flyMeToTheMoon: Chart = {
    id: crypto.randomUUID(),
    title: 'Fly Me to the Moon',
    tempo: 118,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: jazzFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Verse',
        labelColor: '#8b5cf6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['Am7', 'Dm7', 'G7', 'Cmaj7'] },
          { id: crypto.randomUUID(), bars: ['Fmaj7', 'Bm7b5', 'E7', 'Am7  A7'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Chorus',
        labelColor: '#10b981',
        blocks: [
          { id: crypto.randomUUID(), bars: ['Dm7', 'G7', 'Cmaj7', 'A7'] },
          { id: crypto.randomUUID(), bars: ['Dm7', 'G7', 'Cmaj7', 'E7'] }
        ]
      }
    ]
  };

  // Chart 5: Stand By Me (Pop Folder)
  const standByMe: Chart = {
    id: crypto.randomUUID(),
    title: 'Stand By Me',
    tempo: 118,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: popFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Pattern',
        labelRight: 'Repeats throughout',
        labelColor: '#3b82f6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['A', 'A', 'F#m', 'F#m'] },
          { id: crypto.randomUUID(), bars: ['D', 'E', 'A', 'A'], startRepeat: true, endRepeat: true }
        ]
      }
    ]
  };

  // Chart 6: Hotel California (Pop Folder)
  const hotelCalifornia: Chart = {
    id: crypto.randomUUID(),
    title: 'Hotel California',
    tempo: 75,
    time_sig: '4/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: popFolder.id,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Intro / Verse',
        labelColor: '#f59e0b',
        blocks: [
          { id: crypto.randomUUID(), bars: ['Bm', 'F#', 'A', 'E'] },
          { id: crypto.randomUUID(), bars: ['G', 'D', 'Em', 'F#'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Chorus',
        labelColor: '#10b981',
        blocks: [
          { id: crypto.randomUUID(), bars: ['G', 'D', 'F#', 'Bm'] },
          { id: crypto.randomUUID(), bars: ['G', 'D', 'Em', 'F#'] }
        ]
      }
    ]
  };

  // Chart 7: Amazing Grace (Root Level)
  const amazingGrace: Chart = {
    id: crypto.randomUUID(),
    title: 'Amazing Grace',
    tempo: 76,
    time_sig: '3/4',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: null,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Verse',
        labelColor: '#3b82f6',
        blocks: [
          { id: crypto.randomUUID(), bars: ['G', 'G7', 'C', 'G'] },
          { id: crypto.randomUUID(), bars: ['G', 'Em', 'D', 'D7'] },
          { id: crypto.randomUUID(), bars: ['G', 'G7', 'C', 'G'] },
          { id: crypto.randomUUID(), bars: ['Em', 'D7', 'G', 'G'] }
        ]
      }
    ]
  };

  // Chart 8: Hallelujah (Root Level)
  const hallelujah: Chart = {
    id: crypto.randomUUID(),
    title: 'Hallelujah',
    tempo: 56,
    time_sig: '6/8',
    semitone_offset: 0,
    prefer_flats: false,
    folder_id: null,
    created_by: userId,
    updated_at: now,
    lines: [
      {
        id: crypto.randomUUID(),
        label: 'Verse',
        labelColor: '#6366f1',
        blocks: [
          { id: crypto.randomUUID(), bars: ['C', 'Am', 'C', 'Am'] },
          { id: crypto.randomUUID(), bars: ['F', 'G', 'C', 'G'] },
          { id: crypto.randomUUID(), bars: ['C', 'F  G', 'Am', 'F'] },
          { id: crypto.randomUUID(), bars: ['G', 'E7', 'Am', 'Am'] }
        ]
      },
      {
        id: crypto.randomUUID(),
        label: 'Chorus',
        labelColor: '#10b981',
        blocks: [
          { id: crypto.randomUUID(), bars: ['F', 'Am', 'F', 'C  G'] }
        ]
      }
    ]
  };

  // Save all charts
  const allCharts = [
    wayMaker,
    goodnessOfGod,
    autumnLeaves,
    flyMeToTheMoon,
    standByMe,
    hotelCalifornia,
    amazingGrace,
    hallelujah
  ];

  for (const chart of allCharts) {
    await saveChart(chart);
  }

  // ─── 3. SAMPLE LYRICS ────────────────────────────────────────────────────
  const lyricsBody = `[Verse 1]
Amazing grace! How sweet the sound
That saved a wretch like me!
I once was lost, but now am found;
Was blind, but now I see.

[Verse 2]
'Twas grace that taught my heart to fear,
And grace my fears relieved;
How precious did that grace appear
The hour I first believed.

[Verse 3]
Through many dangers, toils and snares,
I have already come;
'Tis grace hath brought me safe thus far,
And grace will lead me home.

[Verse 4]
When we've been there ten thousand years,
Bright shining as the sun,
We've no less days to sing God's praise
Than when we'd first begun.`;

  const sampleLyrics = {
    id: crypto.randomUUID(),
    title: 'Amazing Grace (Complete Lyrics)',
    folder_id: lyricsFolder.id,
    created_by: userId,
    updated_at: now,
    body: lyricsBody,
    content: lyricsBody,
  };

  if (typeof window !== 'undefined') {
    await cacheLyric(sampleLyrics);
    try {
      await supabase.from('lyrics').upsert(sampleLyrics);
    } catch {}
  }

  return {
    foldersCount: 4,
    chartsCount: allCharts.length,
    lyricsCount: 1,
  };
}
