import { supabase } from "./lib/supabase";

function throwIfError(error) {
  if (error) throw error;
}

function mapLibrary(row) {
  const orderedWords = [...(row.vocab_words || [])]
    .sort((a, b) => a.word_order - b.word_order);
  const storedLastIndex = row.vocab_progress?.[0]?.last_index;
  const maximumIndex = Math.max(0, orderedWords.length - 1);

  return {
    id: row.id,
    name: row.name,
    words: orderedWords.map((word) => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      equivalent: word.equivalent || "",
      mastered: word.mastered === true,
    })),
    starredWordIds: orderedWords
      .filter((word) => word.starred)
      .map((word) => word.id),
    lastIndex: Number.isInteger(storedLastIndex)
      ? Math.max(0, Math.min(maximumIndex, storedLastIndex))
      : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const LIBRARY_SELECT = `
  id,
  name,
  created_at,
  updated_at,
  vocab_words (
    id,
    word,
    meaning,
    equivalent,
    starred,
    mastered,
    word_order
  ),
  vocab_progress (last_index)
`;

export async function fetchCloudLibraries(userId) {
  const { data, error } = await supabase
    .from("vocab_lists")
    .select(LIBRARY_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  throwIfError(error);
  return (data || []).map(mapLibrary);
}

async function insertWords(
  listId,
  userId,
  words,
  starredWordIds = [],
  orderOffset = 0,
) {
  if (!words.length) return [];
  const starred = new Set(starredWordIds);
  const rows = words.map((word, index) => ({
    list_id: listId,
    user_id: userId,
    word: word.word,
    meaning: word.meaning,
    equivalent: word.equivalent || null,
    starred: starred.has(word.id),
    mastered: word.mastered === true,
    word_order: orderOffset + index,
  }));
  const { data, error } = await supabase
    .from("vocab_words")
    .insert(rows)
    .select();
  throwIfError(error);
  return data || [];
}

export async function createCloudLibrary(userId, library) {
  const { data: list, error } = await supabase
    .from("vocab_lists")
    .insert({ user_id: userId, name: library.name })
    .select()
    .single();
  throwIfError(error);

  await insertWords(list.id, userId, library.words, library.starredWordIds);
  await saveCloudProgress(userId, list.id, library.lastIndex || 0);
  const libraries = await fetchCloudLibraries(userId);
  return libraries.find((item) => item.id === list.id);
}

export async function replaceCloudLibrary(userId, listId, library) {
  const { error: listError } = await supabase
    .from("vocab_lists")
    .update({ name: library.name })
    .eq("id", listId)
    .eq("user_id", userId);
  throwIfError(listError);

  const { error: deleteError } = await supabase
    .from("vocab_words")
    .delete()
    .eq("list_id", listId)
    .eq("user_id", userId);
  throwIfError(deleteError);
  await insertWords(listId, userId, library.words, library.starredWordIds);
  await saveCloudProgress(userId, listId, library.lastIndex || 0);
  const libraries = await fetchCloudLibraries(userId);
  return libraries.find((item) => item.id === listId);
}

export async function appendCloudWords(userId, library, words) {
  // Touch the parent list so it moves to the top of "My libraries".
  const { error } = await supabase
    .from("vocab_lists")
    .update({ name: library.name })
    .eq("id", library.id)
    .eq("user_id", userId);
  throwIfError(error);

  const insertedWords = await insertWords(
    library.id,
    userId,
    words,
    [],
    library.words.length,
  );

  const appendedWords = insertedWords
    .sort((a, b) => a.word_order - b.word_order)
    .map((word) => ({
      id: word.id,
      word: word.word,
      meaning: word.meaning,
      equivalent: word.equivalent || "",
      mastered: word.mastered === true,
    }));

  return {
    ...library,
    words: [...library.words, ...appendedWords],
    updatedAt: new Date().toISOString(),
  };
}

export async function deleteCloudLibrary(userId, listId) {
  const { error } = await supabase
    .from("vocab_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function updateCloudWord(userId, listId, wordId, changes) {
  const { error } = await supabase
    .from("vocab_words")
    .update(changes)
    .eq("id", wordId)
    .eq("list_id", listId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function saveCloudProgress(userId, listId, lastIndex) {
  const { error } = await supabase.from("vocab_progress").upsert(
    {
      user_id: userId,
      list_id: listId,
      last_index: lastIndex,
    },
    { onConflict: "user_id,list_id" },
  );
  throwIfError(error);
}
