import { Firestore } from "@google-cloud/firestore";
import { env } from "@/lib/config";
import type { GenerationRecord, UploadRecord } from "@/lib/types";

type SessionRecord = {
  sessionId: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
};

type MemoryStore = {
  uploads: Map<string, UploadRecord>;
  generations: Map<string, GenerationRecord>;
  usage: Map<string, number>;
};

declare global {
  var __pairMuseStore__: MemoryStore | undefined;
}

const memoryStore: MemoryStore =
  global.__pairMuseStore__ ??
  {
    uploads: new Map(),
    generations: new Map(),
    usage: new Map(),
  };

if (!global.__pairMuseStore__) {
  global.__pairMuseStore__ = memoryStore;
}

export const MAX_GENERATIONS = 5;

const firestoreEnabled = env.firestoreEnabled === "true";
const firestore = firestoreEnabled
  ? new Firestore({
      projectId: env.projectId,
    })
  : null;

const coll = (name: string) =>
  firestore?.collection(`${env.firestoreCollectionPrefix}_${name}`);

export async function getUsageCount(sessionId: string) {
  if (!firestore || !coll("sessions")) {
    return memoryStore.usage.get(sessionId) ?? 0;
  }

  const snapshot = await coll("sessions")!.doc(sessionId).get();
  return snapshot.exists ? (snapshot.data() as SessionRecord).usageCount ?? 0 : 0;
}

export async function incrementUsage(sessionId: string) {
  if (!firestore || !coll("sessions")) {
    const next = (memoryStore.usage.get(sessionId) ?? 0) + 1;
    memoryStore.usage.set(sessionId, next);
    return next;
  }

  const sessionRef = coll("sessions")!.doc(sessionId);
  const next = await firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(sessionRef);
    const previous = snapshot.exists
      ? ((snapshot.data() as SessionRecord).usageCount ?? 0)
      : 0;
    const now = Date.now();
    const usageCount = previous + 1;
    tx.set(
      sessionRef,
      {
        sessionId,
        usageCount,
        createdAt: snapshot.exists
          ? (snapshot.data() as SessionRecord).createdAt ?? now
          : now,
        updatedAt: now,
      },
      { merge: true },
    );
    return usageCount;
  });

  return next;
}

export async function touchSession(sessionId: string) {
  if (!firestore || !coll("sessions")) {
    if (!memoryStore.usage.has(sessionId)) {
      memoryStore.usage.set(sessionId, 0);
    }
    return {
      usageCount: memoryStore.usage.get(sessionId) ?? 0,
      remainingGenerations: Math.max(
        0,
        MAX_GENERATIONS - (memoryStore.usage.get(sessionId) ?? 0),
      ),
    };
  }

  const sessionRef = coll("sessions")!.doc(sessionId);
  const snapshot = await sessionRef.get();
  const now = Date.now();

  if (!snapshot.exists) {
    await sessionRef.set({
      sessionId,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { usageCount: 0, remainingGenerations: MAX_GENERATIONS };
  }

  const usageCount = (snapshot.data() as SessionRecord).usageCount ?? 0;
  await sessionRef.set({ updatedAt: now }, { merge: true });
  return {
    usageCount,
    remainingGenerations: Math.max(0, MAX_GENERATIONS - usageCount),
  };
}

export async function saveUpload(upload: UploadRecord) {
  if (!firestore || !coll("uploads")) {
    memoryStore.uploads.set(upload.uploadId, upload);
    return;
  }

  await coll("uploads")!.doc(upload.uploadId).set(upload);
}

export async function getUpload(uploadId: string) {
  if (!firestore || !coll("uploads")) {
    return memoryStore.uploads.get(uploadId) ?? null;
  }

  const snapshot = await coll("uploads")!.doc(uploadId).get();
  return snapshot.exists ? (snapshot.data() as UploadRecord) : null;
}

export async function saveGeneration(generation: GenerationRecord) {
  if (!firestore || !coll("generations")) {
    memoryStore.generations.set(generation.id, generation);
    return;
  }

  await coll("generations")!.doc(generation.id).set(generation);
}

export async function findPartnerGeneration(params: {
  sessionId: string;
  uploadId: string;
}) {
  if (!firestore || !coll("generations")) {
    return (
      Array.from(memoryStore.generations.values())
        .filter(
          (item) =>
            item.sessionId === params.sessionId &&
            item.uploadId === params.uploadId &&
            item.type === "partners",
        )
        .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
    );
  }

  const snapshot = await coll("generations")!
    .where("uploadId", "==", params.uploadId)
    .get();

  const matches = snapshot.docs
    .map((doc) => doc.data() as GenerationRecord)
    .filter(
      (item) =>
        item.sessionId === params.sessionId &&
        item.uploadId === params.uploadId &&
        item.type === "partners",
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  return matches[0] ?? null;
}

export async function findPartnerMatch(params: {
  sessionId: string;
  uploadId: string;
  partnerId: string;
}) {
  if (!firestore || !coll("generations")) {
    const generation = Array.from(memoryStore.generations.values())
      .filter(
        (item) =>
          item.sessionId === params.sessionId &&
          item.uploadId === params.uploadId &&
          item.type === "partners",
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .find((item) =>
        item.matches?.some((match) => match.id === params.partnerId),
      );

    const match = generation?.matches?.find(
      (item) => item.id === params.partnerId,
    );

    return generation && match
      ? { generation, match, profile: generation.profile ?? null }
      : null;
  }

  const snapshot = await coll("generations")!
    .where("uploadId", "==", params.uploadId)
    .get();

  for (const doc of snapshot.docs) {
    const generation = doc.data() as GenerationRecord;
    if (
      generation.sessionId !== params.sessionId ||
      generation.uploadId !== params.uploadId ||
      generation.type !== "partners"
    ) {
      continue;
    }
    const match = generation.matches?.find((item) => item.id === params.partnerId);
    if (match) {
      return {
        generation,
        match,
        profile: generation.profile ?? null,
      };
    }
  }

  return null;
}
