"use strict";

const twpI18n = (function () {
  const twpI18n = {};
  let messages = null;
  let fallbackMessages = null;

  function normalizeMessages(result) {
    return Object.keys(result).map((key) => ({
      name: key.toLowerCase(),
      message: result[key].message,
      placeholders: result[key].placeholders,
    }));
  }

  function getLoadedMessage(messageList, messageName, substitutions = null) {
    if (!messageList) return "";

    const message = messageList.find(
      (m) => m.name === messageName.toLowerCase()
    );
    if (!message) return "";

    let finalMessage = message.message;
    if (message.placeholders) {
      for (const [key, value] of Object.entries(message.placeholders)) {
        let content = value.content;
        const match = content.match(/\$([1-9][0-9]*)/);
        const index = match ? parseInt(match[1]) : null;
        if (index) {
          if (substitutions instanceof Array) {
            content = content.replaceAll(
              "$" + index,
              String(substitutions[index - 1])
            );
          } else if (index === 1) {
            content = content.replaceAll("$" + index, String(substitutions));
          } else {
            content = content.replaceAll("$" + index, "");
          }
        }
        finalMessage = finalMessage.replaceAll("$" + key + "$", content);
      }
    }

    return finalMessage;
  }

  async function loadMessages(uiLanguage) {
    for (const basePath of ["_locales", "locales"]) {
      try {
        const response = await fetch(
          chrome.runtime.getURL(`/${basePath}/${uiLanguage}/messages.json`)
        );
        if (response.ok) return normalizeMessages(await response.json());
      } catch (e) {
        console.warn(e);
      }
    }
    throw new Error(`Unable to load messages for ${uiLanguage}`);
  }

  /**
   * Gets the localized string for the specified message
   * @example
   * getMessage("lblAlwaysTranslate", "German")
   * // returns "Always translate from German"
   * getMessage("lblAlwaysTranslate", ["German"])
   * // returns "Always translate from German"
   * @param {string} messageName
   * @param {string | string[]} substitutions
   * @returns {string} localizedString
   */
  twpI18n.getMessage = function (messageName, substitutions = null) {
    try {
      if (messages) {
        return (
          getLoadedMessage(messages, messageName, substitutions) ||
          getLoadedMessage(fallbackMessages, messageName, substitutions) ||
          chrome.i18n.getMessage(messageName, substitutions) ||
          messageName
        );
      } else {
        return (
          getLoadedMessage(fallbackMessages, messageName, substitutions) ||
          chrome.i18n.getMessage(messageName, substitutions) ||
          messageName
        );
      }
    } catch (e) {
      return (
        getLoadedMessage(fallbackMessages, messageName, substitutions) ||
        messageName
      );
    }
  };

  /**
   * translate attribute in all childNodes
   * @param {Document | HTMLElement | ShadowRoot} root
   * @param {string} attributeName
   */
  function translateAttributes(root, attributeName) {
    for (const element of root.querySelectorAll(
      `[data-i18n-${attributeName}]`
    )) {
      let text = twpI18n.getMessage(
        element.getAttribute(`data-i18n-${attributeName}`),
        element.getAttribute("data-i18n-ph-value")
      );
      if (!text) {
        continue;
      }

      element.setAttribute(attributeName, text);
    }
  }

  /**
   * translate innerText and attributes for a Document or HTMLElement
   * @param {Document | HTMLElement | ShadowRoot} root
   */
  twpI18n.translateDocument = function (root = document) {
    for (const element of root.querySelectorAll("[data-i18n]")) {
      let text = twpI18n.getMessage(
        element.getAttribute("data-i18n"),
        element.getAttribute("data-i18n-ph-value")
      );
      if (!text) {
        continue;
      }
      element.textContent = text;
    }

    translateAttributes(root, "title");
    translateAttributes(root, "placeholder");
    translateAttributes(root, "label");
  };

  /**
   * Updates interface location messages based on user preference
   * @returns {Promise<void>}
   */
  twpI18n.updateUiMessages = async (temporaryLanguage = null) => {
    let uiLanguage = temporaryLanguage || twpConfig.get("uiLanguage");
    uiLanguage = uiLanguage.replace("-", "_");
    if (uiLanguage === "default") {
      messages = null;
    } else {
      return await loadMessages(uiLanguage)
        .then((result) => (messages = result))
        .catch((e) => {
          messages = null;
          console.warn(e);
        });
    }
  };

  twpConfig.onReady(async function () {
    fallbackMessages = await loadMessages("en").catch((e) => {
      console.warn(e);
      return null;
    });
    await twpI18n.updateUiMessages();

    twpConfig.onChanged(function (name, newValue) {
      if (name === "uiLanguage") {
        twpI18n.updateUiMessages();
      }
    });
  });

  return twpI18n;
})();
