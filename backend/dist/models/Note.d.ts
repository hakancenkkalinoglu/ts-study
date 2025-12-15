export type Note = {
    id: number;
    clientId: number;
    title: string | null;
    content: string;
    noteDate: string;
    createdAt: string;
    updatedAt: string;
};
export type CreateNoteInput = {
    clientId: number;
    title?: string;
    content: string;
    noteDate: string;
};
export type UpdateNoteInput = {
    title?: string;
    content?: string;
    noteDate?: string;
};
//# sourceMappingURL=Note.d.ts.map