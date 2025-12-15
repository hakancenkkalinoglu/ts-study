// Client model type
export type Client = {
  id: number;
  email: string;
  name: string | null;
  birthDate: string | null;
  password?: string;
  createdAt: string; // SQLite stores dates as strings
  updatedAt: string;
};

// Client input types for API
export type CreateClientInput = {
  email: string;
  name?: string;
  birthDate?: string;
  password?: string;
};

export type UpdateClientInput = {
  email?: string;
  name?: string;
  birthDate?: string;
  password?: string;
};

// Client response (without password)
export type ClientResponse = Omit<Client, 'password'>;


