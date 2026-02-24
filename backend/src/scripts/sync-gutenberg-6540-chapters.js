require('dotenv').config();
const { supabaseAdmin } = require('../config/database');

function parsePartOrder(item) {
  const title = String(item?.title || '');
  const partMatch = title.match(/-\s*(\d{3})\b/);
  if (partMatch?.[1]) return Number(partMatch[1]);
  if (/part\s*1/i.test(title)) return 1;
  return Number.MAX_SAFE_INTEGER;
}

async function main() {
  const { data: contents, error } = await supabaseAdmin
    .from('contents')
    .select('id,title,file_key,format,duration_seconds')
    .eq('content_type', 'audiobook')
    .ilike('title', '%Project Gutenberg #6540%');

  if (error) throw error;
  if (!contents || contents.length === 0) {
    console.log('No Gutenberg #6540 contents found.');
    process.exit(0);
  }

  const sorted = [...contents].sort((a, b) => parsePartOrder(a) - parsePartOrder(b));
  const parent = sorted.find((c) => /part\s*1/i.test(c.title)) || sorted[0];

  console.log(`Parent content: ${parent.id} | ${parent.title}`);

  const { error: deleteError } = await supabaseAdmin
    .from('audiobook_chapters')
    .delete()
    .eq('parent_content_id', parent.id);

  if (deleteError) throw deleteError;

  const chapterRows = sorted.map((item, idx) => ({
    parent_content_id: parent.id,
    chapter_number: idx + 1,
    title: item.title,
    start_seconds: 0,
    end_seconds: null,
    duration_seconds: Number(item.duration_seconds || 0) || null,
    chapter_content_id: item.id,
    chapter_file_key: item.file_key,
    chapter_format: item.format || 'mp3',
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('audiobook_chapters')
    .insert(chapterRows)
    .select('id,chapter_number,title,chapter_content_id');

  if (insertError) throw insertError;

  console.log(`Inserted chapters: ${inserted.length}`);
  inserted.forEach((row) =>
    console.log(`${row.chapter_number}. ${row.title} -> ${row.chapter_content_id}`)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
