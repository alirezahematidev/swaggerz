import { describe, expect, it } from 'vitest';
import {
  applyCase,
  NameRegistry,
  nameFromPath,
  splitWords,
  toFileName,
  toIdentifier,
} from '../../../src/analysis/naming.ts';

describe('splitWords', () => {
  it('splits separators and camel case while keeping acronyms', () => {
    expect(splitWords('getPetByID')).toEqual(['get', 'Pet', 'By', 'ID']);
    expect(splitWords('HTTPServerError')).toEqual(['HTTP', 'Server', 'Error']);
    expect(splitWords('list_pets-v2 now')).toEqual(['list', 'pets', 'v2', 'now']);
  });
});

describe('applyCase', () => {
  it('converts between styles', () => {
    expect(applyCase('get_pet_by_id', 'camelCase')).toBe('getPetById');
    expect(applyCase('getPetByID', 'camelCase')).toBe('getPetByID');
    expect(applyCase('URLShortener', 'camelCase')).toBe('urlShortener');
    expect(applyCase('pet store', 'PascalCase')).toBe('PetStore');
    expect(applyCase('LIST_PETS', 'PascalCase')).toBe('ListPets');
    expect(applyCase('getPetByID', 'snake_case')).toBe('get_pet_by_id');
    expect(applyCase('GetPetByID', 'kebab-case')).toBe('get-pet-by-id');
    expect(applyCase('as-is', 'preserve')).toBe('as-is');
  });
});

describe('toIdentifier', () => {
  it('produces valid, non-reserved identifiers', () => {
    expect(toIdentifier('delete', 'camelCase')).toBe('delete_');
    expect(toIdentifier('2fa-setup', 'camelCase')).toBe('_2faSetup');
    expect(toIdentifier('!!!', 'PascalCase')).toBe('Unnamed');
    expect(toIdentifier('café', 'camelCase')).toBe('cafe');
  });

  it('derives operation names from method and path', () => {
    expect(nameFromPath('GET', '/pets/{petId}/photos')).toBe('getPetsByPetIdPhotos');
    expect(nameFromPath('post', '/')).toBe('post');
  });

  it('builds file names', () => {
    expect(toFileName('GetPetByID', 'kebab-case')).toBe('get-pet-by-id');
    expect(toFileName('Items & Things', 'kebab-case')).toBe('items-things');
  });

  it('avoids names Windows reserves for devices, in every style', () => {
    expect(toFileName('Con', 'kebab-case')).toBe('con_');
    expect(toFileName('aux', 'PascalCase')).toBe('Aux_');
    expect(toFileName('NUL', 'snake_case')).toBe('nul_');
    expect(toFileName('com1', 'camelCase')).toBe('com1_');
    expect(toFileName('LPT9', 'kebab-case')).toBe('lpt9_');
    // Only the whole name is reserved.
    expect(toFileName('Console', 'kebab-case')).toBe('console');
    expect(toFileName('aux data', 'kebab-case')).toBe('aux-data');
  });
});

describe('NameRegistry', () => {
  it('suffixes duplicates deterministically', () => {
    const registry = new NameRegistry();
    expect(registry.claim('list')).toBe('list');
    expect(registry.claim('list')).toBe('list2');
    expect(registry.claim('list')).toBe('list3');
  });

  it('compares file paths case-insensitively', () => {
    const registry = new NameRegistry({ caseInsensitive: true });
    expect(registry.claim('models/item', '-')).toBe('models/item');
    expect(registry.claim('models/Item', '-')).toBe('models/Item-2');
  });
});
