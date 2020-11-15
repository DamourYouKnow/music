export interface Track {
    id: string;
    title: string;
    length: number;
    thumbnail?: string;
}

export interface QueueRequest {
    userId: string;
    room: string;
    url: string;
}