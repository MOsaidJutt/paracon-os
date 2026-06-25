export type MailboxCredentials = {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  folder: string;
};

export type FetchedMessage = {
  uid: number;
  messageId: string | null;
  source: Buffer;
};

export type ParsedBillEmail = {
  messageId: string | null;
  subject: string;
  fromAddress: string | null;
  textBody: string;
  attachments: { filename: string; mime: string; content: Buffer }[];
};
