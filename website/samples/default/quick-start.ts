import { client, getPetById, isGetPetByIdApiError } from './generated/api';

// Once, at startup.
client.setConfig({
  baseUrl: 'https://petstore3.swagger.io/api/v3',
  auth: { api_key: () => sessionStorage.getItem('apiKey') ?? undefined },
});

try {
  const pet = await getPetById({ petId: 10 }, { timeout: 5_000 });
  console.log(pet.name);
} catch (error) {
  // Checking the status narrows the body to that response's type.
  if (isGetPetByIdApiError(error) && error.status === 404) console.error(error.body.message);
  else throw error;
}
