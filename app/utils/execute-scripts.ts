export const executeScripts = (element: Element) => {
  if (!element) {
    return;
  }

  const scripts = element.getElementsByTagName('script');
  const scriptArray = Array.from(scripts);
  for (let i = 0; i < scriptArray.length; i++) {
    const oldScript = scriptArray[i];
    executeScript(oldScript);
  }
};

export const executeScript = (scriptElement: HTMLScriptElement) => {
  const newScript = document.createElement('script');
  Array.from(scriptElement.attributes).forEach((attr) => {
    newScript.setAttribute(attr.name, attr.value);
  });

  if (scriptElement.src) {
    newScript.src = scriptElement.src;
  } else {
    if (scriptElement.textContent?.trim()?.startsWith('(function() {')) {
      newScript.textContent = scriptElement.textContent;
    } else {
      newScript.textContent = `(function() { ${scriptElement.textContent} })();`;
    }
  }

  if (scriptElement.parentNode) {
    scriptElement.parentNode.replaceChild(newScript, scriptElement);
  }
};
