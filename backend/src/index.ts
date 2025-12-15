import { createClient, deleteClientById } from './services/clientService.js';
import type { CreateClientInput } from './models/Client.js';

const client: CreateClientInput = {
  email: 'cenk2@gmail.com',
  name: 'cenk',
  password: '123',
};

const main = async () => {
  const result = await createClient(client);
  console.log('result: ', result);
};

main().catch((err) => {
  console.error('Error in main:', err);
});