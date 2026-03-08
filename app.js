'use strict';

const COVERAGE_TARGET = 8;
const FILTER_DEBOUNCE_MS = 300;
const MAX_COMBINATION_SIZE = 5;

let rawData = [];
let favoriteColors = {};
let filteredData = [];
let debounceTimer;
let elements;

const activeFilters = {
  areas: [],
  standards: [],
  favorites: [],
  nameSearch: '',
  matchAllFavorites: true,
};

window.addEventListener('DOMContentLoaded', initialize);

async function initialize() {
  elements = {
    themeToggle: getRequiredElement('themeToggle'),
    matchAllToggle: getRequiredElement('matchAllToggle'),
    nameSearch: getRequiredElement('nameSearch'),
    totalCount: getRequiredElement('totalCount'),
    filteredCount: getRequiredElement('filteredCount'),
    areaFilters: getRequiredElement('areaFilters'),
    standardsFilters: getRequiredElement('standardsFilters'),
    favoritesFilters: getRequiredElement('favoritesFilters'),
    coverageContent: getRequiredElement('coverageContent'),
    results: getRequiredElement('results'),
  };

  bindEvents();
  setInitialTheme();
  elements.matchAllToggle.checked = activeFilters.matchAllFavorites;
  renderStatusMessage(elements.results, 'loading', 'Loading data...');

  try {
    const [peopleData, colorsData] = await Promise.all([
      fetchJson('data.json'),
      fetchJson('colors.json'),
    ]);

    rawData = normalizePeopleData(peopleData);
    favoriteColors = normalizeFavoriteColors(colorsData, rawData);
    filteredData = [...rawData].sort(comparePeopleByName);

    elements.totalCount.textContent = String(rawData.length);
    elements.filteredCount.textContent = String(filteredData.length);

    createCategoryCheckboxes('area', uniqueSorted(rawData.map((person) => person.Area)));
    createCategoryCheckboxes('standards', uniqueSorted(rawData.map((person) => person.Standards)));
    createCategoryCheckboxes(
      'favorites',
      uniqueSorted(rawData.flatMap((person) => person.Favorites))
    );

    updateFilterCounts();
    openAllFilterAccordions();
    renderResults(filteredData);
    calculateOptimalCoverage();
  } catch (error) {
    console.error('Error loading data:', error);
    renderStatusMessage(
      elements.results,
      'error',
      'Failed to load data. Please try refreshing the page.'
    );
  }
}

function bindEvents() {
  elements.themeToggle.addEventListener('click', toggleTheme);
  elements.matchAllToggle.addEventListener('change', handleMatchModeChange);
  elements.nameSearch.addEventListener('input', debounceFilterChange);
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

function getRequiredElement(id) {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element;
}

function setInitialTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
}

function toggleTheme() {
  const nextTheme =
    document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';

  document.documentElement.setAttribute('data-theme', nextTheme);
}

function handleMatchModeChange(event) {
  activeFilters.matchAllFavorites = event.target.checked;
  filterData();
}

function handleKeyboardShortcuts(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  switch (event.key.toLowerCase()) {
    case 'f':
      event.preventDefault();
      elements.nameSearch.focus();
      break;
    case 't':
      event.preventDefault();
      elements.themeToggle.click();
      break;
    case 'm':
      event.preventDefault();
      elements.matchAllToggle.click();
      break;
    default:
      break;
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: 'no-store' });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizePeopleData(data) {
  if (!Array.isArray(data)) {
    throw new Error('data.json must contain an array of customer records.');
  }

  return data.map((person, index) => {
    if (!person || typeof person !== 'object' || Array.isArray(person)) {
      throw new Error(`Customer record ${index + 1} is not a valid object.`);
    }

    return {
      Name: normalizeRequiredString(person.Name, `Customer ${index + 1} Name`),
      Area: normalizeRequiredString(person.Area, `Customer ${index + 1} Area`),
      Standards: normalizeRequiredString(person.Standards, `Customer ${index + 1} Standards`),
      Favorites: normalizeFavorites(person.Favorites, index + 1),
    };
  });
}

function normalizeFavoriteColors(data, people) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('colors.json must contain an object keyed by favorite name.');
  }

  const normalizedColors = {};

  Object.entries(data).forEach(([favoriteName, colorValue]) => {
    const favorite = normalizeRequiredString(favoriteName, 'Color key');

    if (typeof colorValue !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(colorValue.trim())) {
      throw new Error(`Invalid color value for "${favorite}". Expected a hex color like #AABBCC.`);
    }

    normalizedColors[favorite] = colorValue.trim();
  });

  const allFavorites = uniqueSorted(people.flatMap((person) => person.Favorites));
  const missingFavorites = allFavorites.filter(
    (favorite) => !Object.prototype.hasOwnProperty.call(normalizedColors, favorite)
  );

  if (missingFavorites.length > 0) {
    throw new Error(
      `colors.json is missing colors for: ${missingFavorites.join(', ')}`
    );
  }

  return normalizedColors;
}

function normalizeRequiredString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeFavorites(favorites, recordNumber) {
  if (favorites == null) {
    return [];
  }

  if (!Array.isArray(favorites)) {
    throw new Error(`Favorites for customer record ${recordNumber} must be an array.`);
  }

  const normalizedFavorites = [];

  favorites.forEach((favorite, favoriteIndex) => {
    if (typeof favorite !== 'string' || favorite.trim() === '') {
      throw new Error(
        `Favorite ${favoriteIndex + 1} for customer record ${recordNumber} must be a non-empty string.`
      );
    }

    const normalizedFavorite = favorite.trim();

    if (!normalizedFavorites.includes(normalizedFavorite)) {
      normalizedFavorites.push(normalizedFavorite);
    }
  });

  return normalizedFavorites;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function comparePeopleByName(left, right) {
  return left.Name.localeCompare(right.Name);
}

function openAllFilterAccordions() {
  document.querySelectorAll('.filter-accordion').forEach((accordion) => {
    accordion.open = true;
  });
}

function debounceFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(filterData, FILTER_DEBOUNCE_MS);
}

function createCategoryCheckboxes(category, items) {
  const container = elements[`${category}Filters`];
  const fragment = document.createDocumentFragment();

  items.forEach((item) => {
    const countByFilter = getCountByFilter(category, item);
    const checkbox = document.createElement('input');
    const label = document.createElement('label');
    const textSpan = document.createElement('span');
    const countSpan = document.createElement('span');
    const wrapper = document.createElement('div');

    wrapper.className = 'checkbox-item';

    checkbox.type = 'checkbox';
    checkbox.id = `${category}-${slugify(item)}`;
    checkbox.value = item;
    checkbox.setAttribute('aria-label', `${item} (${countByFilter} customers)`);
    checkbox.addEventListener('change', (event) => {
      const filterKey = getFilterKey(category);

      if (event.target.checked) {
        if (!activeFilters[filterKey].includes(item)) {
          activeFilters[filterKey].push(item);
        }
      } else {
        activeFilters[filterKey] = activeFilters[filterKey].filter((value) => value !== item);
      }

      filterData();
    });

    label.htmlFor = checkbox.id;

    textSpan.className = 'favorite-text';
    textSpan.textContent = item;

    if (category === 'favorites') {
      styleFilterFavorite(textSpan, item);
    }

    countSpan.className = 'count-text';
    countSpan.textContent = ` (${countByFilter})`;

    label.appendChild(textSpan);
    label.appendChild(countSpan);
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    fragment.appendChild(wrapper);
  });

  container.replaceChildren(fragment);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getFilterKey(category) {
  if (category === 'area') {
    return 'areas';
  }

  return category;
}

function styleFilterFavorite(element, favorite) {
  const color = favoriteColors[favorite];

  if (!color) {
    element.style.textDecoration = 'underline';
    element.style.textDecorationStyle = 'wavy';
    element.style.textDecorationColor = 'var(--primary)';
    return;
  }

  element.style.backgroundColor = `${color}20`;
  element.style.color = color;
  element.style.border = `1px solid ${color}`;
}

function styleFavoriteTag(element, favorite) {
  const color = favoriteColors[favorite];

  if (!color) {
    element.style.textDecoration = 'underline';
    element.style.textDecorationStyle = 'wavy';
    element.style.textDecorationColor = 'var(--primary)';
    return;
  }

  element.style.backgroundColor = color;
  element.style.color = getContrastColor(color);
}

function getCountByFilter(category, value) {
  switch (category) {
    case 'area':
      return rawData.filter((person) => person.Area === value).length;
    case 'standards':
      return rawData.filter((person) => person.Standards === value).length;
    case 'favorites':
      return rawData.filter((person) => person.Favorites.includes(value)).length;
    default:
      return 0;
  }
}

function updateFilterCounts() {
  const nameSearch = elements.nameSearch.value.toLowerCase().trim();
  const counts = {
    area: {},
    standards: {},
    favorites: {},
  };

  activeFilters.nameSearch = nameSearch;

  rawData.forEach((person) => {
    const matchesName = !nameSearch || person.Name.toLowerCase().includes(nameSearch);
    const matchesAreaFilters =
      activeFilters.areas.length === 0 || activeFilters.areas.includes(person.Area);
    const matchesStandardsFilters =
      activeFilters.standards.length === 0 || activeFilters.standards.includes(person.Standards);
    const matchesFavoriteFilters = matchesSelectedFavorites(person);

    if (matchesName && matchesStandardsFilters && matchesFavoriteFilters) {
      counts.area[person.Area] = (counts.area[person.Area] || 0) + 1;
    }

    if (matchesName && matchesAreaFilters && matchesFavoriteFilters) {
      counts.standards[person.Standards] = (counts.standards[person.Standards] || 0) + 1;
    }

    if (matchesName && matchesAreaFilters && matchesStandardsFilters) {
      uniqueSorted(person.Favorites).forEach((favorite) => {
        if (activeFilters.favorites.includes(favorite)) {
          if (!activeFilters.matchAllFavorites || matchesSelectedFavorites(person, favorite)) {
            counts.favorites[favorite] = (counts.favorites[favorite] || 0) + 1;
          }
          return;
        }

        if (wouldMatchFavoriteFilters(person, favorite)) {
          counts.favorites[favorite] = (counts.favorites[favorite] || 0) + 1;
        }
      });
    }
  });

  updateCategoryFilterCounts('area', counts.area);
  updateCategoryFilterCounts('standards', counts.standards);
  updateCategoryFilterCounts('favorites', counts.favorites);

  document.querySelectorAll('.filter-count').forEach((countElement) => {
    countElement.textContent = '';
  });
}

function matchesSelectedFavorites(person, favoriteToIgnore) {
  if (activeFilters.favorites.length === 0) {
    return true;
  }

  const selectedFavorites = favoriteToIgnore
    ? activeFilters.favorites.filter((favorite) => favorite !== favoriteToIgnore)
    : activeFilters.favorites;

  if (selectedFavorites.length === 0) {
    return true;
  }

  return activeFilters.matchAllFavorites
    ? selectedFavorites.every((favorite) => person.Favorites.includes(favorite))
    : selectedFavorites.some((favorite) => person.Favorites.includes(favorite));
}

function wouldMatchFavoriteFilters(person, nextFavorite) {
  if (!activeFilters.matchAllFavorites) {
    if (activeFilters.favorites.length === 0) {
      return person.Favorites.includes(nextFavorite);
    }

    return person.Favorites.includes(nextFavorite) || matchesSelectedFavorites(person);
  }

  return [...activeFilters.favorites, nextFavorite].every((favorite) =>
    person.Favorites.includes(favorite)
  );
}

function updateCategoryFilterCounts(category, counts) {
  document.querySelectorAll(`#${category}Filters .checkbox-item`).forEach((item) => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const countSpan = item.querySelector('.count-text');
    const count = counts[checkbox.value] || 0;
    const isDisabled = count === 0 && !checkbox.checked;

    countSpan.textContent = ` (${count})`;
    checkbox.disabled = isDisabled;
    checkbox.setAttribute('aria-label', `${checkbox.value} (${count} customers)`);
    item.classList.toggle('checkbox-item-disabled', isDisabled);
    item.setAttribute('aria-disabled', String(isDisabled));
  });
}

function filterData() {
  elements.results.classList.add('filtering');
  activeFilters.nameSearch = elements.nameSearch.value.toLowerCase().trim();

  requestAnimationFrame(() => {
    try {
      filteredData = rawData
        .filter((person) => {
          const matchesName =
            activeFilters.nameSearch === '' ||
            person.Name.toLowerCase().includes(activeFilters.nameSearch);
          const matchesArea =
            activeFilters.areas.length === 0 || activeFilters.areas.includes(person.Area);
          const matchesStandards =
            activeFilters.standards.length === 0 ||
            activeFilters.standards.includes(person.Standards);

          return matchesName && matchesArea && matchesStandards && matchesSelectedFavorites(person);
        })
        .sort(comparePeopleByName);

      updateFilterCounts();
      calculateOptimalCoverage();
      elements.filteredCount.textContent = String(filteredData.length);
      renderResults(filteredData);
    } finally {
      elements.results.classList.remove('filtering');
    }
  });
}

function renderResults(dataArray) {
  const fragment = document.createDocumentFragment();

  if (dataArray.length === 0) {
    fragment.appendChild(createStatusMessage('no-results', 'No customers match your search criteria'));
    elements.results.replaceChildren(fragment);
    return;
  }

  dataArray.forEach((person) => {
    const card = document.createElement('article');
    const content = document.createElement('div');
    const heading = document.createElement('h3');
    const favoritesLabel = document.createElement('p');
    const tags = document.createElement('div');

    card.className = 'person-card';
    content.className = 'card-content';
    heading.textContent = person.Name;
    tags.className = 'tags';

    content.appendChild(heading);
    content.appendChild(createLabeledParagraph('Area', person.Area));
    content.appendChild(createLabeledParagraph('Standards', person.Standards));

    favoritesLabel.appendChild(createStrongText('Favorites:'));
    content.appendChild(favoritesLabel);

    if (person.Favorites.length === 0) {
      const emptyState = document.createElement('span');
      emptyState.className = 'muted-note';
      emptyState.textContent = 'None listed';
      tags.appendChild(emptyState);
    } else {
      person.Favorites.forEach((favorite) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = favorite;
        styleFavoriteTag(tag, favorite);
        tags.appendChild(tag);
      });
    }

    content.appendChild(tags);
    card.appendChild(content);
    fragment.appendChild(card);
  });

  elements.results.replaceChildren(fragment);
}

function createLabeledParagraph(label, value) {
  const paragraph = document.createElement('p');
  paragraph.appendChild(createStrongText(`${label}:`));
  paragraph.appendChild(document.createTextNode(` ${value}`));
  return paragraph;
}

function createStrongText(text) {
  const strong = document.createElement('strong');
  strong.textContent = text;
  return strong;
}

function renderStatusMessage(container, className, text) {
  container.replaceChildren(createStatusMessage(className, text));
}

function createStatusMessage(className, text) {
  const message = document.createElement('div');
  message.className = className;
  message.textContent = text;
  return message;
}

function getContrastColor(hexColor) {
  const normalizedColor = hexColor.replace('#', '');
  const red = parseInt(normalizedColor.slice(0, 2), 16);
  const green = parseInt(normalizedColor.slice(2, 4), 16);
  const blue = parseInt(normalizedColor.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function calculateOptimalCoverage() {
  const coverageFragment = document.createDocumentFragment();
  const filtersApplied =
    activeFilters.areas.length > 0 ||
    activeFilters.standards.length > 0 ||
    activeFilters.favorites.length > 0 ||
    activeFilters.nameSearch !== '';
  const dataToUse = filtersApplied ? filteredData : rawData;
  const areaCustomers = {};
  const sortedAreas = uniqueSorted(dataToUse.map((person) => person.Area));

  if (filtersApplied) {
    coverageFragment.appendChild(createFilterInfo());
  }

  dataToUse.forEach((person) => {
    if (!areaCustomers[person.Area]) {
      areaCustomers[person.Area] = [];
    }

    areaCustomers[person.Area].push(person);
  });

  sortedAreas.forEach((area) => {
    coverageFragment.appendChild(createCoverageSection(area, areaCustomers[area]));
  });

  if (sortedAreas.length === 0) {
    coverageFragment.appendChild(
      createStatusMessage('no-results', 'No customers match your search criteria')
    );
  }

  elements.coverageContent.replaceChildren(coverageFragment);
}

function createFilterInfo() {
  const wrapper = document.createElement('div');
  const paragraph = document.createElement('p');

  wrapper.className = 'filter-info';
  paragraph.appendChild(createStrongText('Note:'));
  paragraph.appendChild(
    document.createTextNode(' Recommendations are based on your current filter selection.')
  );
  wrapper.appendChild(paragraph);

  return wrapper;
}

function createCoverageSection(area, customers) {
  const areaSection = document.createElement('div');
  const title = document.createElement('h4');

  areaSection.className = 'coverage-set';
  title.textContent = `${area} (${customers.length} total customers)`;
  areaSection.appendChild(title);

  if (customers.length < COVERAGE_TARGET) {
    const tooSmall = document.createElement('p');
    tooSmall.textContent = `Only ${customers.length} customers - insufficient to meet ${COVERAGE_TARGET}+ target`;
    areaSection.appendChild(tooSmall);
    return areaSection;
  }

  const areaFavorites = uniqueSorted(customers.flatMap((person) => person.Favorites));
  let bestCombinations = [];
  let size = 1;

  while (bestCombinations.length === 0 && size <= Math.min(areaFavorites.length, MAX_COMBINATION_SIZE)) {
    bestCombinations = findCombinationsForArea(areaFavorites, size, customers);
    size += 1;
  }

  if (bestCombinations.length === 0) {
    const noResults = document.createElement('p');
    noResults.textContent = `No combination found that covers ${COVERAGE_TARGET}+ customers`;
    areaSection.appendChild(noResults);
    return areaSection;
  }

  const header = document.createElement('p');
  header.style.marginTop = '0.5rem';
  header.appendChild(createStrongText('Best Options:'));
  areaSection.appendChild(header);

  bestCombinations.slice(0, 3).forEach((combination) => {
    areaSection.appendChild(createCombinationResult(combination));
  });

  return areaSection;
}

function findCombinationsForArea(favorites, size, customers) {
  const combinations = [];

  if (size === 1) {
    favorites.forEach((favorite) => {
      const customersWithFavorite = customers.filter((person) => person.Favorites.includes(favorite));

      if (customersWithFavorite.length >= COVERAGE_TARGET) {
        combinations.push({
          favorites: [favorite],
          coverage: customersWithFavorite.length,
          percentage: ((customersWithFavorite.length / customers.length) * 100).toFixed(1),
          breakdown: [{ favorite, count: customersWithFavorite.length }],
        });
      }
    });

    return combinations.sort(sortCombinations);
  }

  function generateCombinations(startIndex, currentSet) {
    if (currentSet.length === size) {
      const coveredCustomers = customers.filter((person) =>
        currentSet.some((favorite) => person.Favorites.includes(favorite))
      );

      if (coveredCustomers.length >= COVERAGE_TARGET) {
        combinations.push({
          favorites: [...currentSet],
          coverage: coveredCustomers.length,
          percentage: ((coveredCustomers.length / customers.length) * 100).toFixed(1),
          breakdown: currentSet.map((favorite) => ({
            favorite,
            count: customers.filter((person) => person.Favorites.includes(favorite)).length,
          })),
        });
      }

      return;
    }

    for (let index = startIndex; index < favorites.length; index += 1) {
      currentSet.push(favorites[index]);
      generateCombinations(index + 1, currentSet);
      currentSet.pop();
    }
  }

  generateCombinations(0, []);
  return combinations.sort(sortCombinations);
}

function sortCombinations(left, right) {
  if (left.favorites.length !== right.favorites.length) {
    return left.favorites.length - right.favorites.length;
  }

  if (left.coverage !== right.coverage) {
    return right.coverage - left.coverage;
  }

  return left.favorites.join(',').localeCompare(right.favorites.join(','));
}

function createCombinationResult(combination) {
  const wrapper = document.createElement('div');
  const tags = document.createElement('div');
  const info = document.createElement('div');
  const breakdown = document.createElement('div');

  wrapper.className = 'combo-result';
  tags.className = 'coverage-tags';
  info.className = 'coverage-info';
  breakdown.className = 'breakdown-list';
  info.textContent = `Combined: ${combination.coverage} customers (${combination.percentage}%)`;

  combination.favorites.forEach((favorite) => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = favorite;
    styleFavoriteTag(tag, favorite);
    tags.appendChild(tag);
  });

  combination.breakdown.forEach((item) => {
    const breakdownItem = document.createElement('div');
    breakdownItem.className = 'breakdown-item';
    breakdownItem.textContent = `${item.favorite}: ${item.count} customers`;
    breakdown.appendChild(breakdownItem);
  });

  info.appendChild(breakdown);
  wrapper.appendChild(tags);
  wrapper.appendChild(info);

  return wrapper;
}
