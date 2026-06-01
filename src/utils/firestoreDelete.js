import { deleteDoc, doc } from "firebase/firestore";
import { addDeveloperConsoleEntry } from "./developerConsole.js";

export function firestoreDeleteTarget(collectionName, id) {
  const sourceCollection = String(collectionName ?? "");
  const documentId = String(id ?? "");

  if (!sourceCollection) {
    throw new Error("Delete target is missing a source collection.");
  }

  if (!documentId) {
    throw new Error(`Delete target ${sourceCollection} is missing a document ID.`);
  }

  const deletePath = `${sourceCollection}/${documentId}`;

  return {
    sourceCollection,
    documentId,
    deletePath,
    url: `firestore://${deletePath}`
  };
}

export async function deleteFirestoreDocument(db, collectionName, id, { source = "delete action" } = {}) {
  const requestTime = new Date().toISOString();
  const startedAt = performance.now();
  const target = firestoreDeleteTarget(collectionName, id);
  const requestPayload = {
    sourceCollection: target.sourceCollection,
    collectionName: target.sourceCollection,
    documentId: target.documentId,
    id: target.documentId,
    deletePath: target.deletePath
  };

  try {
    await deleteDoc(doc(db, target.sourceCollection, target.documentId));

    addDeveloperConsoleEntry({
      source,
      method: "DELETE",
      url: target.url,
      status: 200,
      ok: true,
      sourceCollection: target.sourceCollection,
      documentId: target.documentId,
      deletePath: target.deletePath,
      requestTime,
      responseTime: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      requestPayload,
      responseJson: {
        deleted: true,
        sourceCollection: target.sourceCollection,
        documentId: target.documentId,
        deletePath: target.deletePath
      }
    });
  } catch (error) {
    addDeveloperConsoleEntry({
      source,
      method: "DELETE",
      url: target.url,
      status: error.code || null,
      ok: false,
      sourceCollection: target.sourceCollection,
      documentId: target.documentId,
      deletePath: target.deletePath,
      firebaseErrorCode: error.code || null,
      requestTime,
      responseTime: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startedAt),
      requestPayload,
      errorJson: {
        code: error.code || null,
        firebaseErrorCode: error.code || null,
        message: error.message,
        sourceCollection: target.sourceCollection,
        documentId: target.documentId,
        deletePath: target.deletePath
      }
    });

    throw error;
  }
}
