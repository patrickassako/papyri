require('dotenv').config();
const { supabaseAdmin } = require('../config/database');

async function main() {
  const title = 'Jungle Tales of Tarzan (Project Gutenberg #8758)';
  const payload = {
    title,
    author: 'Edgar Rice Burroughs',
    description: 'Livre audio Project Gutenberg #8758 (version test 4 chapitres). Source: https://www.gutenberg.org/ebooks/8758',
    content_type: 'audiobook',
    format: 'mp3',
    language: 'en',
    cover_url: 'https://www.gutenberg.org/cache/epub/8758/pg8758.cover.medium.jpg',
    file_key: 'audiobooks/gutenberg-8758/8758-000.mp3',
    file_size_bytes: 235856,
    is_published: true,
    published_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('contents')
    .select('id')
    .eq('content_type', 'audiobook')
    .ilike('title', '%Project Gutenberg #8758%')
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  let contentId = null;
  if (existing?.id) {
    contentId = existing.id;
    const { error: updateError } = await supabaseAdmin
      .from('contents')
      .update(payload)
      .eq('id', contentId);
    if (updateError) throw updateError;
  } else {
    const { data: created, error: createError } = await supabaseAdmin
      .from('contents')
      .insert(payload)
      .select('id')
      .single();
    if (createError) throw createError;
    contentId = created.id;
  }

  const { data: category } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('slug', 'histoire')
    .maybeSingle();

  if (category?.id) {
    const { data: rel } = await supabaseAdmin
      .from('content_categories')
      .select('id')
      .eq('content_id', contentId)
      .eq('category_id', category.id)
      .maybeSingle();

    if (!rel) {
      const { error: relError } = await supabaseAdmin
        .from('content_categories')
        .insert({
          content_id: contentId,
          category_id: category.id,
        });
      if (relError) throw relError;
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('audiobook_chapters')
    .delete()
    .eq('parent_content_id', contentId);
  if (deleteError) throw deleteError;

  const parts = ['000', '001', '002', '003'];
  const rows = parts.map((part, index) => ({
    parent_content_id: contentId,
    chapter_number: index + 1,
    title: `Jungle Tales of Tarzan - Chapter ${String(index + 1).padStart(2, '0')}`,
    start_seconds: 0,
    end_seconds: null,
    duration_seconds: null,
    chapter_content_id: contentId,
    chapter_file_key: `audiobooks/gutenberg-8758/8758-${part}.mp3`,
    chapter_format: 'mp3',
    metadata: { source_file: `8758-${part}.mp3` },
  }));

  const { data: inserted, error: chapterError } = await supabaseAdmin
    .from('audiobook_chapters')
    .insert(rows)
    .select('id, chapter_number, title');
  if (chapterError) throw chapterError;

  console.log(JSON.stringify({
    content_id: contentId,
    chapters: inserted.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
