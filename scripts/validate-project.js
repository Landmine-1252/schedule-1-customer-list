#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

const data = readJson('data.json');
const colors = readJson('colors.json');
const indexHtml = readText('index.html');
const readme = readText('README.md');
const appJsPath = path.join(rootDir, 'app.js');

validatePeopleData(data);
validateColors(colors);
validateFavoriteCoverage(data, colors);
validateHtml(indexHtml);
validateRepositoryLinks(indexHtml, readme);
validateAppScript(appJsPath);

if (warnings.length > 0) {
  console.warn('Warnings:');
  warnings.forEach((warning) => {
    console.warn(`- ${warning}`);
  });
  console.warn('');
}

if (failures.length > 0) {
  console.error('Validation failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}

const uniqueFavorites = [...new Set(data.flatMap((person) => person.Favorites))];

console.log('Validation passed.');
console.log(`Customers: ${data.length}`);
console.log(`Favorites: ${uniqueFavorites.length}`);

function readJson(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);

  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    failures.push(`Unable to read ${relativePath}: ${error.message}`);
    return null;
  }
}

function readText(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);

  try {
    return fs.readFileSync(absolutePath, 'utf8');
  } catch (error) {
    failures.push(`Unable to read ${relativePath}: ${error.message}`);
    return '';
  }
}

function validatePeopleData(people) {
  if (!Array.isArray(people)) {
    failures.push('data.json must contain an array.');
    return;
  }

  people.forEach((person, index) => {
    const prefix = `data.json record ${index + 1}`;

    if (!person || typeof person !== 'object' || Array.isArray(person)) {
      failures.push(`${prefix} must be an object.`);
      return;
    }

    validateNonEmptyString(person.Name, `${prefix} Name`);
    validateNonEmptyString(person.Area, `${prefix} Area`);
    validateNonEmptyString(person.Standards, `${prefix} Standards`);

    if (!Array.isArray(person.Favorites)) {
      failures.push(`${prefix} Favorites must be an array.`);
      return;
    }

    person.Favorites.forEach((favorite, favoriteIndex) => {
      validateNonEmptyString(favorite, `${prefix} Favorite ${favoriteIndex + 1}`);
    });

    const normalizedFavorites = person.Favorites.map((favorite) => favorite.trim());
    const duplicateFavorites = normalizedFavorites.filter(
      (favorite, favoriteIndex) => normalizedFavorites.indexOf(favorite) !== favoriteIndex
    );

    if (duplicateFavorites.length > 0) {
      warnings.push(`${prefix} contains duplicate favorites: ${[...new Set(duplicateFavorites)].join(', ')}`);
    }
  });
}

function validateColors(colorMap) {
  if (!colorMap || typeof colorMap !== 'object' || Array.isArray(colorMap)) {
    failures.push('colors.json must contain an object.');
    return;
  }

  Object.entries(colorMap).forEach(([favorite, color]) => {
    validateNonEmptyString(favorite, 'colors.json key');

    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color.trim())) {
      failures.push(`colors.json entry "${favorite}" must be a 6-digit hex color.`);
    }
  });
}

function validateFavoriteCoverage(people, colorMap) {
  if (!Array.isArray(people) || !colorMap || typeof colorMap !== 'object' || Array.isArray(colorMap)) {
    return;
  }

  const favorites = [...new Set(people.flatMap((person) => person.Favorites.map((favorite) => favorite.trim())))];
  const missingColors = favorites.filter(
    (favorite) => !Object.prototype.hasOwnProperty.call(colorMap, favorite)
  );
  const unusedColors = Object.keys(colorMap).filter((favorite) => !favorites.includes(favorite));

  if (missingColors.length > 0) {
    failures.push(`colors.json is missing favorites used in data.json: ${missingColors.join(', ')}`);
  }

  if (unusedColors.length > 0) {
    warnings.push(`colors.json contains unused favorites: ${unusedColors.join(', ')}`);
  }
}

function validateHtml(html) {
  const requiredIds = [
    'themeToggle',
    'matchAllToggle',
    'nameSearch',
    'totalCount',
    'filteredCount',
    'areaFilters',
    'standardsFilters',
    'favoritesFilters',
    'coverageContent',
    'results',
  ];

  requiredIds.forEach((id) => {
    if (!html.includes(`id="${id}"`)) {
      failures.push(`index.html is missing required element #${id}.`);
    }
  });

  if (!html.includes('<script src="app.js"></script>')) {
    failures.push('index.html must load app.js.');
  }
}

function validateRepositoryLinks(html, documentation) {
  const requiredLinks = [
    'https://github.com/Landmine-1252/schedule-1-customer-list',
    'https://github.com/Landmine-1252/schedule-1-customer-list/issues',
  ];

  requiredLinks.forEach((link) => {
    if (!html.includes(link) && !documentation.includes(link)) {
      failures.push(`Expected repository link not found: ${link}`);
    }
  });
}

function validateAppScript(absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    failures.push('app.js is missing.');
    return;
  }

  if (fs.statSync(absolutePath).size === 0) {
    failures.push('app.js is empty.');
  }
}

function validateNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    failures.push(`${label} must be a non-empty string.`);
  }
}
