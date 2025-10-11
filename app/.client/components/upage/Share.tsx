import qrcode from 'node_modules/qrcode/build/qrcode?raw';
import { getLocalStorage } from '~/.client/persistence';
import closeIcon from './icons/close.svg?raw';
import copyIcon from './icons/copy.svg?raw';
import shareIcon from './icons/share.svg?raw';
import twitterIcon from './icons/twitter.svg?raw';
import wechatIcon from './icons/wechat.svg?raw';
import weiboIcon from './icons/weibo.svg?raw';

export function UPageShare() {
  const recommend = getLocalStorage('recommend');

  const styles = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }

    /* 分享按钮样式 */
    .upage-share-btn {
      position: fixed;
      bottom: 70px;
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

    .upage-share-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
    }

    .upage-share-icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .upage-ripple {
      position: absolute;
      border-radius: 50%;
      background-color: rgba(0, 62, 183, 0.2);
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }

    .upage-text {
      margin: 0;
      font-weight: 500;
      font-size: 12px;
      white-space: nowrap;
    }

    /* 分享对话框样式 */
    .upage-share-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .upage-share-modal.active {
      opacity: 1;
      visibility: visible;
    }

    .upage-share-content {
      width: 90%;
      max-width: 500px;
      background-color: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      transform: scale(0.9);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
    }

    .upage-share-modal.active .upage-share-content {
      transform: scale(1);
      opacity: 1;
    }

    .upage-share-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .upage-share-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin: 0;
    }

    .upage-share-close {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.2s ease;
      border: none;
      outline: none;
      padding: 2px;
    }

    .upage-share-close:hover {
      background-color: #e0e0e0;
    }

    .upage-share-preview {
      width: 100%;
      height: 200px;
      border-radius: 8px;
      background-color: #f5f5f5;
      margin-bottom: 16px;
      overflow: hidden;
      position: relative;
    }

    .upage-share-preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .upage-share-options {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      justify-content: center;
    }

    .upage-share-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transition: transform 0.2s ease;
      width: 60px;
    }

    .upage-share-option:hover {
      transform: translateY(-3px);
    }

    .upage-share-option-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #f0f0f0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
    }

    .upage-share-option-icon svg {
      width: 20px;
      height: 20px;
    }

    .upage-share-option-name {
      font-size: 12px;
      color: #666;
      text-align: center;
    }

    .upage-share-success {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10001;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .upage-share-success.active {
      opacity: 1;
      visibility: visible;
    }

    /* 微信分享二维码弹窗样式 */
    .upage-wechat-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }

    .upage-wechat-modal.active {
      opacity: 1;
      visibility: visible;
    }

    .upage-wechat-content {
      width: 90%;
      max-width: 320px;
      background-color: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      transform: scale(0.9);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      text-align: center;
    }

    .upage-wechat-modal.active .upage-wechat-content {
      transform: scale(1);
      opacity: 1;
    }

    .upage-wechat-title {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      margin: 0 0 15px 0;
    }

    .upage-wechat-subtitle {
      font-size: 14px;
      color: #666;
      margin: 0 0 20px 0;
    }

    .upage-wechat-qrcode {
      width: 200px;
      height: 200px;
      margin: 0 auto 15px;
      background-color: #f5f5f5;
      border-radius: 8px;
      overflow: hidden;
    }

    .upage-wechat-qrcode img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .upage-wechat-tip {
      font-size: 13px;
      color: #888;
      margin: 0 0 20px 0;
    }

    .upage-wechat-actions {
      display: flex;
      justify-content: space-between;
    }

    .upage-wechat-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .upage-wechat-btn-cancel {
      background-color: #f0f0f0;
      color: #666;
      margin-right: 10px;
    }

    .upage-wechat-btn-cancel:hover {
      background-color: #e0e0e0;
    }

    .upage-wechat-btn-save {
      background-color: #07C160;
      color: white;
    }

    .upage-wechat-btn-save:hover {
      background-color: #06AD56;
    }
  `;

  const script = `
    (function() {
      document.addEventListener('DOMContentLoaded', function() {
        var shareBtn = document.querySelector('.upage-share-btn');
        var shareModal = document.querySelector('.upage-share-modal');
        var closeBtn = document.querySelector('.upage-share-close');
        var shareSuccess = document.querySelector('.upage-share-success');
        var wechatModal = document.querySelector('#wechatModal');
        var wechatQrcode = document.querySelector('#wechatQrcode');
        var wechatCancel = document.querySelector('#wechatCancel');
        var wechatSave = document.querySelector('#wechatSave');

        if (shareBtn && shareModal) {
          shareBtn.addEventListener('click', function(e) {
            var ripple = document.createElement('span');
            ripple.classList.add('upage-ripple');

            var rect = shareBtn.getBoundingClientRect();
            var x = e.clientX - rect.left;
            var y = e.clientY - rect.top;

            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';

            shareBtn.appendChild(ripple);

            setTimeout(function() {
              ripple.remove();
            }, 600);

            shareModal.classList.add('active');
          });
        }

        if (closeBtn && shareModal) {
          closeBtn.addEventListener('click', function() {
            shareModal.classList.remove('active');
          });
        }

        if (shareModal) {
          shareModal.addEventListener('click', function(e) {
            if (e.target === shareModal) {
              shareModal.classList.remove('active');
            }
          });
        }

        if (wechatCancel && wechatModal) {
          wechatCancel.addEventListener('click', function() {
            wechatModal.classList.remove('active');
          });
        }

        if (wechatModal) {
          wechatModal.addEventListener('click', function(e) {
            if (e.target === wechatModal) {
              wechatModal.classList.remove('active');
            }
          });
        }

        if (wechatSave) {
          wechatSave.addEventListener('click', function() {
            var img = wechatQrcode.querySelector('img');
            if (img) {
              var a = document.createElement('a');
              a.href = img.src;
              a.download = '微信分享二维码.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);

              showSuccessMessage('二维码已保存');
            } else {
              showSuccessMessage('保存失败，请重试');
            }
          });
        }

        var shareOptions = document.querySelectorAll('.upage-share-option');
        if (shareOptions && shareOptions.length > 0) {
          shareOptions.forEach(function(option) {
            option.addEventListener('click', function() {
              var platform = this.getAttribute('data-platform');
              var url = encodeURIComponent(window.location.href);
              var shareText = '我刚刚用 UPage发布了一个页面，快来看看吧：' + window.location.href + '${recommend ? `\\n\\n注册凌霞账户，限免体验中：https://www.lxware.cn?code=${recommend}` : ''}';
              switch(platform) {
                case 'copy':
                  navigator.clipboard.writeText(shareText).then(function() {
                    showSuccessMessage('链接已复制到剪贴板');
                  }).catch(function() {
                    var tempInput = document.createElement('input');
                    document.body.appendChild(tempInput);
                    tempInput.value = shareText;
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);
                    showSuccessMessage('链接已复制到剪贴板');
                  });
                  break;
                case 'wechat':
                  generateWechatQrCode(window.location.href);
                  break;
                case 'weibo':
                  openShareWindow('http://service.weibo.com/share/share.php?url=' + url + '&title=' + encodeURIComponent(shareText));
                  break;
                case 'twitter':
                  openShareWindow('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText));
                  break;
                default:
                  break;
              }

              if (shareModal && platform !== 'wechat') {
                setTimeout(function() {
                  shareModal.classList.remove('active');
                }, 500);
              }
            });
          });
        }

        function generateWechatQrCode(url) {
          if (!wechatQrcode || !wechatModal) return;

          wechatQrcode.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">生成中...</div>';

          try {
            if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
              window.QRCode.toDataURL(url, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 200,
                color: {
                  dark: '#000000',
                  light: '#ffffff'
                }
              }, function(err, dataURL) {
                if (err || !dataURL) {
                  fallbackToApiQrCode(url);
                  return;
                }

                var qrcodeImage = document.createElement('img');
                qrcodeImage.src = dataURL;

                qrcodeImage.onload = function() {
                  wechatQrcode.innerHTML = '';
                  wechatQrcode.appendChild(qrcodeImage);
                  shareModal.classList.remove('active');
                  wechatModal.classList.add('active');
                };

                qrcodeImage.onerror = function() {
                  fallbackToApiQrCode(url);
                };
              });
            } else {
              fallbackToApiQrCode(url);
            }
          } catch (e) {
            console.error('QR code generation error:', e);
            fallbackToApiQrCode(url);
          }
        }

        function fallbackToApiQrCode(url) {
          var qrcodeImage = document.createElement('img');
          qrcodeImage.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);

          qrcodeImage.onload = function() {
            wechatQrcode.innerHTML = '';
            wechatQrcode.appendChild(qrcodeImage);
            shareModal.classList.remove('active');
            wechatModal.classList.add('active');
          };

          qrcodeImage.onerror = function() {
            wechatQrcode.innerHTML = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:red;">生成失败</div>';
            showSuccessMessage('二维码生成失败，请重试');
          };
        }

        function showSuccessMessage(message) {
          if (shareSuccess) {
            shareSuccess.textContent = message;
            shareSuccess.classList.add('active');

            setTimeout(function() {
              shareSuccess.classList.remove('active');
            }, 2000);
          }
        }

        function openShareWindow(url) {
          window.open(url, '_blank', 'width=600,height=500,toolbar=no,menubar=no,scrollbars=yes,resizable=yes');
        }
      });
    })();
  `;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: qrcode }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <div className="upage-share-btn">
        <div className="upage-share-icon" dangerouslySetInnerHTML={{ __html: shareIcon }}></div>
        <span className="upage-text">分享</span>
      </div>

      <div className="upage-share-modal">
        <div className="upage-share-content">
          <div className="upage-share-header">
            <h3 className="upage-share-title">分享页面</h3>
            <button className="upage-share-close" dangerouslySetInnerHTML={{ __html: closeIcon }}></button>
          </div>

          <div className="upage-share-options">
            <div className="upage-share-option" data-platform="copy">
              <div className="upage-share-option-icon" dangerouslySetInnerHTML={{ __html: copyIcon }}></div>
              <span className="upage-share-option-name">复制链接</span>
            </div>

            <div className="upage-share-option" data-platform="wechat">
              <div className="upage-share-option-icon" dangerouslySetInnerHTML={{ __html: wechatIcon }}></div>
              <span className="upage-share-option-name">微信</span>
            </div>

            <div className="upage-share-option" data-platform="weibo">
              <div className="upage-share-option-icon" dangerouslySetInnerHTML={{ __html: weiboIcon }}></div>
              <span className="upage-share-option-name">微博</span>
            </div>

            <div className="upage-share-option" data-platform="twitter">
              <div className="upage-share-option-icon" dangerouslySetInnerHTML={{ __html: twitterIcon }}></div>
              <span className="upage-share-option-name">Twitter</span>
            </div>
          </div>
        </div>
      </div>

      <div className="upage-wechat-modal" id="wechatModal">
        <div className="upage-wechat-content">
          <h3 className="upage-wechat-title">微信分享</h3>
          <p className="upage-wechat-subtitle">请扫描二维码或长按识别</p>
          <div className="upage-wechat-qrcode" id="wechatQrcode"></div>
          <p className="upage-wechat-tip">长按二维码可保存或识别</p>
          <div className="upage-wechat-actions">
            <button className="upage-wechat-btn upage-wechat-btn-cancel" id="wechatCancel">
              取消
            </button>
            <button className="upage-wechat-btn upage-wechat-btn-save" id="wechatSave">
              保存到相册
            </button>
          </div>
        </div>
      </div>

      <div className="upage-share-success"></div>
    </>
  );
}
