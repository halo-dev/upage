import logo from './icons/logo.svg?raw';

export function UPageBrand() {
  const styles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }

    .upage-floating-bar {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: rgba(255, 255, 255, 0.9);
      border-radius: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #333;
      z-index: 9999;
      transition: all 0.3s ease;
      animation: fadeIn 0.5s ease-in-out;
      cursor: pointer;
    }

    .upage-floating-bar:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .upage-logo {
      width: 20px;
      height: 20px;
      margin-right: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .upage-text {
      margin: 0;
      font-weight: 500;
      font-size: 12px;
      white-space: nowrap;
    }

    .upage-ripple {
      position: absolute;
      border-radius: 50%;
      background-color: rgba(0, 62, 183, 0.2);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
  `;

  const script = `
    (function() {
      document.addEventListener('DOMContentLoaded', function() {
        // 品牌悬浮框点击事件
        var floatingBar = document.querySelector('.upage-floating-bar');
        if (floatingBar) {
          floatingBar.addEventListener('click', function(e) {
            var ripple = document.createElement('span');
            ripple.classList.add('upage-ripple');

            var rect = floatingBar.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;

            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            floatingBar.appendChild(ripple);

            setTimeout(function() {
              ripple.remove();
            }, 600);

            window.open('https://upage.ai', '_blank');
          });
        }
      });
    })();
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <div className="upage-floating-bar">
        <div className="upage-logo" dangerouslySetInnerHTML={{ __html: logo }}></div>
        <span className="upage-text">使用 UPage 构建</span>
      </div>
    </>
  );
}
