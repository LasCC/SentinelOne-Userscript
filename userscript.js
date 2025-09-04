// ==UserScript==
// @name         SentinelOne: PowerQuery Custom Menu
// @version      1
// @description  Custom menu for threat hunting rules with a compact UI, cell copy on query page, and quick unpin feature.
// @author       https://github.com/LasCC
// @match        *://*.sentinelone.net/query*
// @match        *://*.sentinelone.net/events*
// @downloadURL  https://raw.githubusercontent.com/LasCC/SentinelOne-Userscript/refs/heads/master/userscript.js
// @updateURL    https://raw.githubusercontent.com/LasCC/SentinelOne-Userscript/refs/heads/master/userscript.js
// @grant        GM_xmlhttpRequest
// @icon         https://www.google.com/s2/favicons?sz=64&domain=sentinelone.com
// ==/UserScript==

(function () {
    "use strict";
    const QUERIES_URL =
        "https://raw.githubusercontent.com/LasCC/SentinelOne-Userscript/refs/heads/master/s1_powerquery_hunting.json";
    const PINNED_QUERIES_KEY = "s1_pinned_hunting_queries";

    let allFetchedQueries = [];

    const listIconSVG = `
    <img src="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2077.09%2095.88%22%20xmlns%3Axlink%3D%22http%3A//www.w3.org/1999/xlink%22%3E%0A%20%3Cdefs%3E%0A%20%20%3Cstyle%3E%0A%20%20%20.cls-1%7Bfill%3A%236b0aea%3Bfill-rule%3Aevenodd%3B%7D%0A%20%20%3C/style%3E%0A%20%3C/defs%3E%0A%20%3Cg%20id%3D%22Layer_2%22%20data-name%3D%22Layer%202%22%3E%0A%20%20%3Cg%20id%3D%22ART%22%3E%0A%20%20%20%3Cpath%20class%3D%22cls-1%22%20d%3D%22M32.08%2C0H45V77.25H32.08ZM48.13%2C95.88l12.91-8V21a32.21%2C32.21%2C0%2C0%2C0-12.91-5.72ZM16%2C87.92l12.92%2C8V15.32A32.19%2C32.19%2C0%2C0%2C0%2C16%2C21ZM64.17%2C3.67V86.48l6-3.72a15.3%2C15.3%2C0%2C0%2C0%2C6.89-13V30.65C77.09%2C19.37%2C64.17%2C3.67%2C64.17%2C3.67ZM0%2C69.73a15.27%2C15.27%2C0%2C0%2C0%2C6.89%2C13l6%2C3.72V3.67S0%2C19.37%2C0%2C30.65Z%22/%3E%0A%20%20%3C/g%3E%0A%20%3C/g%3E%0A%3C/svg%3E" style="height:1rem;" alt="Logo" srcset="">
    `;
    const searchIconSVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>`;
    const starIconSVG = `<svg class="star-icon" width="14" height="14" viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
    const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    function getPinnedQueries() {
        try {
            const pinned = localStorage.getItem(PINNED_QUERIES_KEY);
            return pinned ? JSON.parse(pinned) : [];
        } catch (e) {
            console.error("Could not parse pinned queries from localStorage", e);
            return [];
        }
    }

    function isQueryPinned(queryName) {
        return getPinnedQueries().includes(queryName);
    }

    function togglePinQuery(queryName) {
        let pinned = getPinnedQueries();
        const index = pinned.indexOf(queryName);
        if (index > -1) {
            pinned.splice(index, 1);
        } else {
            pinned.push(queryName);
        }
        localStorage.setItem(PINNED_QUERIES_KEY, JSON.stringify(pinned));
        renderPinnedQueriesSection();
        document.dispatchEvent(new CustomEvent("pinnedQueryChange"));
    }

    function executeQuery(query) {
        const queryTextarea = document.querySelector(
            '[data-test-id="power-query-input"]'
        );
        const searchButton = document.querySelector(
            '[data-test-id="power-query-search-button"]'
        );
        if (queryTextarea) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                "value"
            ).set;
            nativeInputValueSetter.call(queryTextarea, query);
            ["input", "change"].forEach((eventType) =>
                queryTextarea.dispatchEvent(new Event(eventType, { bubbles: true }))
            );
            queryTextarea.focus();
        }
        if (searchButton) searchButton.click();
        showNotification("Query executed successfully!");
    }

    function showNotification(message) {
        document
            .querySelectorAll(".hunting-queries-notification")
            .forEach((n) => n.remove());
        const notification = document.createElement("div");
        notification.className = "hunting-queries-notification";
        notification.innerHTML = `
        <span class="hunting-queries-notification-icon">✓</span>
        <span class="hunting-queries-notification-text">${message}</span>`;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add("hunting-queries-notification-fade");
            setTimeout(() => notification.remove(), 300);
        }, 2500);
    }

    function injectAndRenderPinnedQueriesSection() {
        const powerQueryPage = document.querySelector(".Page.PowerQueries");
        if (!powerQueryPage) return;

        let container = document.getElementById("pinned-queries-container");
        if (!container) {
            container = document.createElement("div");
            container.id = "pinned-queries-container";
            container.className = "PowerQueries__PinnedSection";

            const inputArea = document.querySelector(".PowerQueries__InputArea");
            if (inputArea && inputArea.nextSibling) {
                inputArea.parentNode.insertBefore(container, inputArea.nextSibling);
            } else if (inputArea) {
                inputArea.parentNode.appendChild(container);
            }
        }
        renderPinnedQueriesSection();
    }

    function renderPinnedQueriesSection() {
        const container = document.getElementById("pinned-queries-container");
        if (!container || !Array.isArray(allFetchedQueries)) {
            if (container) container.style.display = "none";
            return;
        }

        const pinnedQueryNames = getPinnedQueries();
        const pinnedQueries = allFetchedQueries.filter((q) =>
            pinnedQueryNames.includes(q.name)
        );
        pinnedQueries.sort((a, b) => a.name.localeCompare(b.name));

        container.innerHTML = "";

        if (pinnedQueries.length === 0) {
            container.style.display = "none";
            return;
        }

        container.style.display = "block";

        const list = document.createElement("div");
        list.className = "pinned-queries-list";
        container.appendChild(list);

        const header = document.createElement("div");
        header.className = "pinned-queries-header";
        header.innerHTML = `
      <svg class="star-icon" width="10" height="10" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" fill="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
      </svg>
      <span>Pinned</span>
    `;
        list.appendChild(header);

        pinnedQueries.forEach((queryObj) => {
            const pinButtonWrapper = document.createElement("div");
            pinButtonWrapper.className = "pinned-query-btn";
            pinButtonWrapper.title = `Run query: ${queryObj.name}`;

            const nameSpan = document.createElement("span");
            nameSpan.textContent = queryObj.name;
            pinButtonWrapper.appendChild(nameSpan);

            const unpinButton = document.createElement("button");
            unpinButton.className = "unpin-button";
            unpinButton.innerHTML = "&times;";
            unpinButton.title = "Unpin query";
            unpinButton.addEventListener("click", (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePinQuery(queryObj.name);
            });
            pinButtonWrapper.appendChild(unpinButton);

            pinButtonWrapper.addEventListener("click", (e) => {
                e.preventDefault();
                executeQuery(queryObj.query);
            });
            list.appendChild(pinButtonWrapper);
        });
    }

    function addCustomQueryButton(predefinedQueries) {
        const toolbar = document.querySelector(
            ".Toolbar.Toolbar.PowerQueries__ControlsToolbar"
        );
        if (!toolbar) return;

        const tableButtonToolbarItem = toolbar
            .querySelector(
                '.Toolbar__Item.Toolbar__Item > div > [data-test-id="graph-style-dropdown"]'
            )
            ?.closest(".Toolbar__Item.Toolbar__Item");

        if (!tableButtonToolbarItem) return;
        if (document.getElementById("custom-queries-button-container")) return;

        addCustomStyles();

        const customQueriesContainer = document.createElement("div");
        customQueriesContainer.id = "custom-queries-button-container";
        customQueriesContainer.className = "Toolbar__Item Toolbar__Item";

        const dropdownDiv = document.createElement("div");
        dropdownDiv.className = "dropdown hunting-queries-dropdown";
        dropdownDiv.setAttribute("tabindex", "-1");

        const button = document.createElement("button");
        button.id = "custom-queries-button";
        button.type = "button";
        button.className =
            "Button Button--Secondary Dropdown__Button btn btn-secondary btn-sm hunting-queries-btn";
        button.setAttribute("data-test-id", "custom-queries-button");
        button.setAttribute("aria-haspopup", "true");
        button.setAttribute("aria-expanded", "false");
        button.setAttribute("role", "button");
        button.innerHTML = `
      <span class="Button__LeftIcon">${listIconSVG}</span>
      Hunting Queries
      <span class="Button__RightIcon hunting-queries-arrow">
        <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-1k33q06" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="ArrowDropDownIcon"><path d="m7 10 5 5 5-5z"></path></svg>
      </span>
    `;

        const dropdownMenu = document.createElement("div");
        dropdownMenu.className = "Dropdown__Menu dropdown-menu hunting-queries-menu";
        dropdownMenu.setAttribute("role", "menu");

        const dropdownInner = document.createElement("div");
        dropdownInner.className = "dropdown-menu__inner";
        dropdownInner.setAttribute("data-test-id", "custom-queries-menu");

        const dropdownHeader = document.createElement("div");
        dropdownHeader.className = "hunting-queries-header";
        dropdownHeader.innerHTML = `
      <div class="hunting-queries-title">
        ${listIconSVG}
        <span>Hunting Queries</span>
      </div>
      <div class="hunting-queries-count">
        (<span id="query-count">0</span>)
      </div>
    `;

        const searchContainer = document.createElement("div");
        searchContainer.className = "hunting-queries-search-container";

        const searchWrapper = document.createElement("div");
        searchWrapper.className = "hunting-queries-search-wrapper";

        const searchIcon = document.createElement("div");
        searchIcon.className = "hunting-queries-search-icon";
        searchIcon.innerHTML = searchIconSVG;

        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "hunting-queries-search";
        searchInput.placeholder = "Search queries...";
        searchInput.setAttribute("aria-label", "Search hunting queries");

        const clearButton = document.createElement("button");
        clearButton.className = "hunting-queries-clear";
        clearButton.innerHTML = "×";
        clearButton.title = "Clear search";
        clearButton.style.display = "none";

        searchWrapper.appendChild(searchIcon);
        searchWrapper.appendChild(searchInput);
        searchWrapper.appendChild(clearButton);
        searchContainer.appendChild(searchWrapper);

        const tabsContainer = document.createElement("div");
        tabsContainer.className = "hunting-queries-tabs";

        const tabsScroll = document.createElement("div");
        tabsScroll.className = "hunting-queries-tabs-scroll";

        const navigationDiv = document.createElement("div");
        navigationDiv.className = "hunting-queries-list";
        navigationDiv.setAttribute("role", "navigation");

        const loadingDiv = document.createElement("div");
        loadingDiv.className = "hunting-queries-loading";
        loadingDiv.innerHTML = `
      <div class="hunting-queries-spinner"></div>
      <span>Loading queries...</span>
    `;

        const emptyState = document.createElement("div");
        emptyState.className = "hunting-queries-empty";
        emptyState.innerHTML = `
      <div class="hunting-queries-empty-icon">🔍</div>
      <div class="hunting-queries-empty-title">No queries found</div>
      <div class="hunting-queries-empty-subtitle">Try adjusting your search or filters</div>
    `;
        emptyState.style.display = "none";

        let activeCategory = "All";
        let isLoading = true;

        const categories = ["All", "Pinned"];
        if (Array.isArray(predefinedQueries)) {
            const uniqueCategories = new Set(
                predefinedQueries
                    .map((q) => q.category)
                    .filter(Boolean)
                    .filter((cat) => cat.trim() !== "")
            );
            categories.push(...Array.from(uniqueCategories).sort());
            isLoading = false;
        }

        function updateQueryCount(count) {
            const countElement = document.getElementById("query-count");
            if (countElement) {
                countElement.textContent = count;
            }
        }

        function renderTabs() {
            tabsScroll.innerHTML = "";
            categories.forEach((category) => {
                const tabButton = document.createElement("button");
                tabButton.className = `hunting-queries-tab ${
                    category === activeCategory ? "active" : ""
                }`;
                tabButton.setAttribute("data-category", category);

                if (category === "Pinned") {
                    tabButton.innerHTML = `<span class="hunting-queries-tab-content">${starIconSVG} <span>Pinned</span></span>`;
                } else {
                    tabButton.innerHTML = `<span class="hunting-queries-tab-content">${category}</span>`;
                }

                let count = 0;
                if (Array.isArray(predefinedQueries)) {
                    if (category === "Pinned") {
                        const pinnedNames = getPinnedQueries();
                        count = predefinedQueries.filter((q) =>
                            pinnedNames.includes(q.name)
                        ).length;
                    } else if (category === "All") {
                        count = predefinedQueries.length;
                    } else {
                        count = predefinedQueries.filter(
                            (q) => q.category === category
                        ).length;
                    }
                } else if (category === "Pinned") {
                    count = getPinnedQueries().length;
                }

                if (count > 0) {
                    const badge = document.createElement("span");
                    badge.className = "hunting-queries-tab-badge";
                    badge.textContent = count;
                    tabButton.appendChild(badge);
                }

                tabButton.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveCategory(category);
                });
                tabsScroll.appendChild(tabButton);
            });
        }

        function setActiveCategory(category) {
            activeCategory = category;
            document
                .querySelectorAll(".hunting-queries-tab")
                .forEach((tab) => tab.classList.remove("active"));
            document
                .querySelector(`[data-category="${category}"]`)
                ?.classList.add("active");
            renderQueryItems(searchInput.value);
        }

        function renderQueryItems(searchTerm = "") {
            if (isLoading) {
                navigationDiv.innerHTML = "";
                navigationDiv.appendChild(loadingDiv);
                updateQueryCount(0);
                return;
            }

            navigationDiv.innerHTML = "";
            emptyState.style.display = "none";
            const lowerSearchTerm = searchTerm.toLowerCase().trim();
            const pinnedQueryNames = getPinnedQueries();

            if (!Array.isArray(predefinedQueries)) {
                const errorItem = document.createElement("div");
                errorItem.className = "hunting-queries-error";
                errorItem.innerHTML = `
          <div class="hunting-queries-error-icon">⚠️</div>
          <div class="hunting-queries-error-title">Failed to load queries</div>
          <div class="hunting-queries-error-subtitle">Please try refreshing the page</div>`;
                navigationDiv.appendChild(errorItem);
                updateQueryCount(0);
                return;
            }

            let filteredQueries = predefinedQueries.filter((queryObj) => {
                const matchesCategory =
                    activeCategory === "All" ||
                    (activeCategory === "Pinned" &&
                        pinnedQueryNames.includes(queryObj.name)) ||
                    queryObj.category === activeCategory;
                const matchesSearch =
                    !lowerSearchTerm ||
                    queryObj.name.toLowerCase().includes(lowerSearchTerm) ||
                    (queryObj.description &&
                        queryObj.description.toLowerCase().includes(lowerSearchTerm));
                return matchesCategory && matchesSearch;
            });

            filteredQueries.sort((a, b) => {
                const aIsPinned = pinnedQueryNames.includes(a.name);
                const bIsPinned = pinnedQueryNames.includes(b.name);
                if (aIsPinned && !bIsPinned) return -1;
                if (!aIsPinned && bIsPinned) return 1;
                return a.name.localeCompare(b.name);
            });

            updateQueryCount(filteredQueries.length);

            if (filteredQueries.length === 0) {
                navigationDiv.appendChild(emptyState);
                emptyState.style.display = "block";
                return;
            }

            const groupedQueries = {};
            filteredQueries.forEach((query) => {
                const category = query.category || "Uncategorized";
                if (!groupedQueries[category]) groupedQueries[category] = [];
                groupedQueries[category].push(query);
            });

            Object.entries(groupedQueries).forEach(([category, queries]) => {
                if (
                    activeCategory === "All" &&
                    Object.keys(groupedQueries).length > 1
                ) {
                    const categoryHeader = document.createElement("div");
                    categoryHeader.className = "hunting-queries-category-header";
                    categoryHeader.textContent = category;
                    navigationDiv.appendChild(categoryHeader);
                }

                queries.forEach((queryObj) => {
                    const queryItem = document.createElement("div");
                    queryItem.className = "hunting-queries-item";
                    queryItem.setAttribute("data-query", queryObj.query);

                    const queryContent = document.createElement("div");
                    queryContent.className = "hunting-queries-item-content";
                    const queryName = document.createElement("div");
                    queryName.className = "hunting-queries-item-name";
                    queryName.textContent = queryObj.name;
                    const queryMeta = document.createElement("div");
                    queryMeta.className = "hunting-queries-item-meta";

                    if (queryObj.description) {
                        const description = document.createElement("div");
                        description.className = "hunting-queries-item-description";
                        description.textContent = queryObj.description;
                        queryMeta.appendChild(description);
                    }
                    if (queryObj.category && activeCategory === "All") {
                        const categoryTag = document.createElement("span");
                        categoryTag.className = "hunting-queries-item-category";
                        categoryTag.textContent = queryObj.category;
                        queryMeta.appendChild(categoryTag);
                    }
                    queryContent.appendChild(queryName);
                    if (queryMeta.children.length > 0) {
                        queryContent.appendChild(queryMeta);
                    }
                    const queryActions = document.createElement("div");
                    queryActions.className = "hunting-queries-item-actions";

                    const pinButton = document.createElement("button");
                    pinButton.className = "hunting-queries-pin-btn";
                    pinButton.innerHTML = starIconSVG;
                    if (isQueryPinned(queryObj.name)) {
                        pinButton.classList.add("pinned");
                        pinButton.title = "Unpin query";
                    } else {
                        pinButton.title = "Pin query";
                    }

                    pinButton.addEventListener("click", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePinQuery(queryObj.name);
                    });

                    const useButton = document.createElement("button");
                    useButton.className = "hunting-queries-use-btn";
                    useButton.innerHTML = "Use";
                    useButton.title = "Insert and run this query";

                    queryActions.appendChild(pinButton);
                    queryActions.appendChild(useButton);
                    queryItem.appendChild(queryContent);
                    queryItem.appendChild(queryActions);

                    if (lowerSearchTerm) {
                        highlightSearchTerm(queryName, lowerSearchTerm);
                        if (queryObj.description) {
                            const descElement = queryContent.querySelector(
                                ".hunting-queries-item-description"
                            );
                            if (descElement) {
                                highlightSearchTerm(descElement, lowerSearchTerm);
                            }
                        }
                    }

                    const handleQuerySelection = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        executeQuery(queryObj.query);
                        closeDropdown();
                    };
                    queryItem.addEventListener("click", handleQuerySelection);
                    useButton.addEventListener("click", handleQuerySelection);
                    queryItem.setAttribute("tabindex", "0");
                    queryItem.addEventListener("keydown", (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleQuerySelection(e);
                        }
                    });
                    navigationDiv.appendChild(queryItem);
                });
            });
        }

        function highlightSearchTerm(element, searchTerm) {
            const text = element.textContent;
            const regex = new RegExp(
                `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
                "gi"
            );
            element.innerHTML = text.replace(
                regex,
                '<mark class="hunting-queries-highlight">$1</mark>'
            );
        }

        function closeDropdown() {
            dropdownMenu.classList.remove("show");
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("active");
        }

        function openDropdown() {
            dropdownMenu.classList.add("show");
            button.setAttribute("aria-expanded", "true");
            button.classList.add("active");
            setTimeout(() => searchInput.focus(), 100);
        }

        tabsContainer.appendChild(tabsScroll);
        dropdownInner.appendChild(dropdownHeader);
        dropdownInner.appendChild(searchContainer);
        dropdownInner.appendChild(tabsContainer);
        dropdownInner.appendChild(navigationDiv);
        dropdownMenu.appendChild(dropdownInner);
        dropdownDiv.appendChild(button);
        dropdownDiv.appendChild(dropdownMenu);
        customQueriesContainer.appendChild(dropdownDiv);

        tableButtonToolbarItem.parentNode.insertBefore(
            customQueriesContainer,
            tableButtonToolbarItem.nextSibling
        );

        searchInput.addEventListener("input", (e) => {
            const value = e.target.value;
            clearButton.style.display = value ? "block" : "none";
            renderQueryItems(value);
        });
        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeDropdown();
        });
        clearButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            searchInput.value = "";
            clearButton.style.display = "none";
            renderQueryItems("");
            searchInput.focus();
        });
        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isExpanded = button.getAttribute("aria-expanded") === "true";
            if (isExpanded) closeDropdown();
            else {
                openDropdown();
                renderTabs();
                renderQueryItems(searchInput.value);
            }
        });
        document.addEventListener("click", (e) => {
            if (
                !dropdownDiv.contains(e.target) &&
                dropdownMenu.classList.contains("show")
            )
                closeDropdown();
        });

        document.addEventListener("pinnedQueryChange", () => {
            if (dropdownMenu.classList.contains("show")) {
                renderTabs();
                renderQueryItems(searchInput.value);
            }
        });

        renderTabs();
        renderQueryItems();
    }

    function addCellCopyButtons(cells) {
        if (!window.location.href.includes("/query")) {
            return;
        }

        cells.forEach((cell) => {
            if (cell.textContent.trim() === "" || cell.querySelector(".cell-copy-button")) {
                return;
            }
            cell.classList.add("copy-button-added");

            const button = document.createElement("button");
            button.className = "cell-copy-button";
            button.innerHTML = copyIconSVG;
            button.title = "Copy cell content";

            button.addEventListener("click", (e) => {
                e.stopPropagation();
                const cellClone = cell.cloneNode(true);
                const buttonInClone = cellClone.querySelector(".cell-copy-button");
                if (buttonInClone) {
                    buttonInClone.remove();
                }
                const textToCopy = cellClone.textContent.trim();

                navigator.clipboard
                    .writeText(textToCopy)
                    .then(() => {
                        button.innerHTML = checkIconSVG;
                        button.title = "Copied!";
                        button.classList.add("copied");
                        setTimeout(() => {
                            button.innerHTML = copyIconSVG;
                            button.title = "Copy cell content";
                            button.classList.remove("copied");
                        }, 2000);
                    })
                    .catch((err) => {
                        console.error("Failed to copy text: ", err);
                        button.title = "Failed to copy!";
                        setTimeout(() => {
                            button.title = "Copy cell content";
                        }, 2000);
                    });
            });
            cell.appendChild(button);
        });
    }

    function addCustomStyles() {
        if (document.getElementById("hunting-queries-styles")) return;
        const styles = document.createElement("style");
        styles.id = "hunting-queries-styles";
        styles.textContent = `
      /* --- Compact Pinned Queries Section --- */
      .PowerQueries__PinnedSection {
        padding: 6px var(--s1-distance-5);
        border-top: 1px solid var(--s1-N-20-color);
        border-bottom: 1px solid var(--s1-N-20-color);
        background: var(--s1-N-5-color);
        display: none; /* Hidden by default */
      }
      .pinned-queries-list { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
      .pinned-queries-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 600; color: var(--s1-N-70-color);
        text-transform: uppercase; letter-spacing: 0.5px;
        margin-right: 8px;
      }
      .pinned-queries-header .star-icon { color: var(--s1-P-50-color); }
      .pinned-query-btn {
        position: relative;
        display: inline-flex; align-items: center;
        font-size: 10px; padding: 2px 8px;
        background-color: var(--s1-N-15-color);
        border: 1px solid var(--s1-N-25-color);
        border-radius: var(--s1-border-radius-3);
        color: var(--s1-N-80-color);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .pinned-query-btn:hover {
        transform: translateY(-1px);
        box-shadow: var(--s1-shadow-2);
        background-color: var(--s1-N-20-color);
        border-color: var(--s1-N-30-color);
      }
      .unpin-button {
        position: absolute;
        top: -6px; right: -6px;
        width: 16px; height: 16px;
        border-radius: 50%;
        background: var(--s1-N-80-color);
        color: var(--s1-N-0-color);
        border: 1px solid var(--s1-N-0-color);
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; line-height: 1;
        cursor: pointer;
        opacity: 0;
        transform: scale(0.5);
        transition: all 0.15s ease-out;
        z-index: 1;
      }
      .pinned-query-btn:hover .unpin-button {
        opacity: 1;
        transform: scale(1);
      }
      .unpin-button:hover { background: var(--s1-R-50-color); }

      /* --- Main Dropdown & Button --- */
      .hunting-queries-dropdown { position: relative; }
      .hunting-queries-btn { transition: all 0.2s ease; position: relative; }
      .hunting-queries-btn:hover { transform: translateY(-1px); box-shadow: var(--s1-shadow-6); }
      .hunting-queries-arrow { transition: transform 0.2s ease; }
      .hunting-queries-btn.active .hunting-queries-arrow { transform: rotate(180deg); }

      .hunting-queries-menu {
        position: absolute; top: calc(100% + 4px); right: 0;
        min-width: 450px; max-width: 550px; max-height: 65vh;
        z-index: 1050; display: none; background: var(--s1-N-0-color);
        border: 1px solid var(--s1-N-20-color); border-radius: var(--s1-distance-2);
        box-shadow: var(--s1-shadow-16); overflow: hidden; animation: hunting-queries-fadeIn 0.2s ease;
        font-family: var(--s1-font-family);
      }
      .hunting-queries-menu.show { display: block; }
      @keyframes hunting-queries-fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

      /* --- Compact Dropdown Header --- */
      .hunting-queries-header {
        display: flex; align-items: center; gap: 8px;
        padding: 8px var(--s1-distance-5);
        background: var(--s1-N-10-color);
        border-bottom: 1px solid var(--s1-N-20-color);
      }
      .hunting-queries-title { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px; color: var(--s1-N-100-color); }
      .hunting-queries-title img { filter: none; }
      .hunting-queries-count { font-size: 12px; color: var(--s1-N-60-color); font-weight: 400; }

      /* --- Compact Search & Tabs --- */
      .hunting-queries-search-container { padding: 8px var(--s1-distance-5); background: var(--s1-N-10-color); border-bottom: 1px solid var(--s1-N-20-color); }
      .hunting-queries-search-wrapper { position: relative; display: flex; align-items: center; }
      .hunting-queries-search-icon { position: absolute; left: 10px; color: var(--s1-N-50-color); z-index: 1; }
      .hunting-queries-search {
        width: 100%; padding: 6px 10px 6px 34px;
        border: 1px solid var(--s1-N-30-color); border-radius: var(--s1-border-radius-3); font-size: 13px;
        background: var(--s1-N-0-color); color: var(--s1-N-100-color); transition: border-color 0.2s ease;
      }
      .hunting-queries-search:focus { outline: none; border-color: var(--s1-P-50-color); box-shadow: 0 0 0 2px color-mix(in srgb, var(--s1-P-50-color) 20%, transparent); }
      .hunting-queries-clear { position: absolute; right: 4px; background: none; border: none; font-size: 18px; color: var(--s1-N-50-color); cursor: pointer; padding: 4px; border-radius: 50%; transition: all 0.2s ease; }
      .hunting-queries-clear:hover { background: var(--s1-N-20-color); color: var(--s1-N-70-color); }

      .hunting-queries-tabs { background: var(--s1-N-10-color); border-bottom: 1px solid var(--s1-N-20-color); overflow: hidden; }
      .hunting-queries-tabs-scroll { display: flex; padding: 8px var(--s1-distance-5); overflow-x: auto; gap: 6px; scrollbar-width: none; -ms-overflow-style: none; }
      .hunting-queries-tabs-scroll::-webkit-scrollbar { display: none; }
      .hunting-queries-tab {
        display: flex; align-items: center; gap: 6px; padding: 3px 10px;
        border: 1px solid var(--s1-N-30-color); border-radius: 16px; background: var(--s1-N-0-color); color: var(--s1-N-60-color);
        font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
      }
      .hunting-queries-tab:hover { border-color: var(--s1-P-50-color); color: var(--s1-P-50-color); }
      .hunting-queries-tab.active { background: var(--s1-P-50-color); color: var(--s1-const-N-0-color, #fff); border-color: var(--s1-P-50-color); }
      .hunting-queries-tab-content { display: flex; align-items: center; gap: 4px; }
      .hunting-queries-tab-badge {
        background: var(--s1-N-20-color); color: var(--s1-N-70-color); font-size: 9px; font-weight: 600;
        padding: 1px 5px; border-radius: 8px; margin-left: 4px;
      }
      .hunting-queries-tab.active .hunting-queries-tab-badge { background: rgba(0,0,0,0.2); color: var(--s1-const-N-0-color, #fff); }

      /* --- Denser Query List --- */
      .hunting-queries-list { max-height: 350px; overflow-y: auto; padding: 4px 0; background: var(--s1-N-0-color); }
      .hunting-queries-category-header {
        padding: 6px var(--s1-distance-5) 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;
        background: var(--s1-N-10-color); color: var(--s1-N-70-color); border-bottom: 1px solid var(--s1-N-20-color); margin-bottom: 4px;
      }
      .hunting-queries-item { display: flex; align-items: center; justify-content: space-between; padding: 6px var(--s1-distance-5); cursor: pointer; transition: background-color 0.2s ease, border-left-color 0.2s ease; border-left: 3px solid transparent; }
      .hunting-queries-item:hover { background: var(--s1-N-10-color); border-left-color: var(--s1-P-50-color); }
      .hunting-queries-item:focus, .hunting-queries-item:focus-within { outline: none; background: var(--s1-N-15-color); border-left-color: var(--s1-P-50-color); }
      .hunting-queries-item-content { flex: 1; min-width: 0; }
      .hunting-queries-item-name { font-size: 13px; font-weight: 500; color: var(--s1-N-100-color); line-height: 1.3; }
      .hunting-queries-item-meta { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
      .hunting-queries-item-description { font-size: 11px; color: var(--s1-N-60-color); line-height: 1.3; }
      .hunting-queries-item-category { display: inline-block; font-size: 10px; background: var(--s1-N-15-color); color: var(--s1-N-70-color); padding: 1px 5px; border-radius: var(--s1-border-radius-3); font-weight: 500; width: fit-content; }
      .hunting-queries-item-actions { display: flex; align-items: center; opacity: 0; transition: opacity 0.2s ease; gap: 6px; }
      .hunting-queries-item:hover .hunting-queries-item-actions, .hunting-queries-item:focus-within .hunting-queries-item-actions { opacity: 1; }
      .hunting-queries-pin-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--s1-N-40-color); transition: all 0.2s ease; }
      .hunting-queries-pin-btn:hover { background: var(--s1-N-15-color); color: var(--s1-P-50-color); }
      .hunting-queries-pin-btn .star-icon { fill: none; stroke: currentColor; }
      .hunting-queries-pin-btn.pinned .star-icon { color: var(--s1-P-50-color); fill: var(--s1-P-50-color); stroke: var(--s1-P-50-color); }
      .hunting-queries-pin-btn.pinned:hover { color: var(--s1-P-40-color); }
      .hunting-queries-use-btn { background: var(--s1-P-50-color); color: var(--s1-const-N-0-color, #fff); border: none; padding: 3px 8px; border-radius: var(--s1-border-radius-3); font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
      .hunting-queries-use-btn:hover { background: var(--s1-P-40-color); }
      .hunting-queries-highlight { background: var(--s1-N-20-color); color: var(--s1-N-100-color); padding: 0 2px; border-radius: 2px; font-weight: 500; }

      /* --- Cell Copy Button (Safe Absolute Positioning) --- */
      .BaseTable__row-cell {
          position: relative;
      }
      .cell-copy-button {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          background: var(--s1-N-10-color); border: 1px solid var(--s1-N-30-color);
          border-radius: 4px; padding: 3px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: opacity 0.15s ease, background-color 0.15s ease;
          z-index: 2;
      }
      .BaseTable__row-cell:hover .cell-copy-button { opacity: 1; }
      .cell-copy-button:hover { background: var(--s1-N-20-color); }
      .cell-copy-button svg { width: 14px; height: 14px; color: var(--s1-N-70-color); transition: color 0.15s ease; }
      .cell-copy-button:hover svg { color: var(--s1-N-100-color); }
      .cell-copy-button.copied svg { color: var(--s1-G-50-color); }

      /* --- Utility & Notification --- */
      .hunting-queries-loading, .hunting-queries-error, .hunting-queries-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px var(--s1-distance-5); text-align: center; }
      .hunting-queries-spinner { width: 20px; height: 20px; border: 2px solid var(--s1-N-70-color); border-top-color: var(--s1-P-50-color); border-radius: 50%; animation: hunting-queries-spin 1s linear infinite; margin-bottom: 12px; }
      @keyframes hunting-queries-spin { to { transform: rotate(360deg); } }
      .hunting-queries-empty-icon, .hunting-queries-error-icon { font-size: 28px; margin-bottom: 12px; color: var(--s1-N-60-color); }
      .hunting-queries-empty-title, .hunting-queries-error-title { font-size: 13px; font-weight: 600; color: var(--s1-N-70-color); margin-bottom: 4px; }
      .hunting-queries-empty-subtitle, .hunting-queries-error-subtitle { font-size: 11px; color: var(--s1-N-50-color); }

      .hunting-queries-notification {
        position: fixed; bottom: var(--s1-distance-5); right: var(--s1-distance-5);
        background: var(--s1-N-0-color); border: 1px solid var(--s1-N-20-color); border-radius: var(--s1-border-radius-3);
        padding: 8px 12px; z-index: 10000; animation: hunting-queries-slideIn 0.3s ease;
        box-shadow: var(--s1-shadow-6); display: flex; align-items: center; gap: 8px; max-width: 220px; font-size: 12px;
      }
      .hunting-queries-notification-icon { width: 14px; height: 14px; border-radius: 50%; background: var(--s1-G-50-color); color: var(--s1-const-N-0-color, #fff); display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: bold; flex-shrink: 0; }
      .hunting-queries-notification-text { font-weight: 500; color: var(--s1-N-100-color); }
      .hunting-queries-notification-fade { animation: hunting-queries-fadeOut 0.3s ease; }
      @keyframes hunting-queries-slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes hunting-queries-fadeOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
        document.head.appendChild(styles);
    }

    function fetchQueriesAndInject() {
        GM_xmlhttpRequest({
            method: "GET",
            url: QUERIES_URL,
            onload: function (response) {
                try {
                    const queries = JSON.parse(response.responseText);
                    allFetchedQueries = queries;
                    addCustomQueryButton(queries);
                    injectAndRenderPinnedQueriesSection();
                } catch (e) {
                    console.error("Error parsing queries JSON:", e);
                    allFetchedQueries = null;
                    addCustomQueryButton(null);
                    injectAndRenderPinnedQueriesSection();
                }
            },
            onerror: function (error) {
                console.error("Error fetching queries:", error);
                allFetchedQueries = null;
                addCustomQueryButton(null);
                injectAndRenderPinnedQueriesSection();
            },
        });
    }

    const observer = new MutationObserver((mutations, obs) => {
        if (!document.getElementById("custom-queries-button-container")) {
            const powerQueryPage = document.querySelector(
                '.Page.PowerQueries[data-test-id="power-query-page"]'
            );
            if (powerQueryPage) {
                const toolbar = powerQueryPage.querySelector(
                    ".Toolbar.Toolbar.PowerQueries__ControlsToolbar"
                );
                const tableButton = powerQueryPage.querySelector(
                    '[data-test-id="graph-style-dropdown"]'
                );
                if (toolbar && tableButton) {
                    fetchQueriesAndInject();
                }
            }
        }

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches(".BaseTable__row-cell")) {
                        addCellCopyButtons([node]);
                    }
                    const newCells = node.querySelectorAll(
                        ".BaseTable__row-cell:not(.copy-button-added)"
                    );
                    if (newCells.length > 0) {
                        addCellCopyButtons(newCells);
                    }
                }
            }
        }
    });

    const appRoot = document.getElementById("root");
    if (appRoot) {
        observer.observe(appRoot, { childList: true, subtree: true });
    }
})();
