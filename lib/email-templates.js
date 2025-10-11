export function passwordResetHtml(link, assetsBase = '') {
  const base = assetsBase || process.env.PUBLIC_BASE_URL || '';
  const logoSrc = base ? `${base.replace(/\/$/,'')}/static/logo-light.svg` : 'https://lnk.az/static/logo-light.svg';
  return `<!DOCTYPE html>
<html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="az">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Şifrəni sıfırlayın • LNK.az</title>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" type="text/css">
  <style>
    *{box-sizing:border-box} body{margin:0;padding:0;background:#ffffff;-webkit-text-size-adjust:none;text-size-adjust:none}
    a[x-apple-data-detectors]{color:inherit !important;text-decoration:inherit !important}
    p{line-height:inherit} sup,sub{font-size:75%;line-height:0}
    .row-content{width:500px;margin:0 auto}
    @media (max-width:520px){.row-content{width:100%!important}.stack .column{width:100%!important;display:block}}
    .btn{display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:600}
  </style>
</head>
<body style="background-color:#FFFFFF; margin:0; padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;">
    <tr><td>
      <table class="row-content stack" role="presentation" cellpadding="0" cellspacing="0" style="color:#000; width:500px; margin:0 auto;">
        <tr>
          <td style=\"padding:24px 0; text-align:center;\">
            <img src=\"${logoSrc}\" width=\"40\" alt=\"LNK.az\" style=\"display:inline-block;border:0;height:auto;\"/>
          </td>
        </tr>
        <tr>
          <td style="padding:0 20px 8px 20px; text-align:center;">
            <h1 style="margin:0; font-family:'Poppins', Arial, Helvetica, sans-serif; font-size:28px; font-weight:700; color:#1e0e4b;">Salam!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:0 20px 16px 20px;">
            <div style="font-family:'Poppins', Arial, Helvetica, sans-serif; font-size:15px; color:#444a5b; line-height:1.6;">
              <p style="margin:0 0 12px 0;">Parolunuzu sıfırlamaq üçün aşağıdakı düyməyə klikləyin. Link 1 saat etibarlıdır.</p>
              <p style="margin:0 0 18px 0; text-align:center;">
                <a class="btn" href="${link}" target="_blank" rel="noopener">Şifrəni sıfırla</a>
              </p>
              <p style="margin:0 0 12px 0; word-break:break-all;">Əgər düymə işləmirsə, bu linki brauzerə köçürün:<br/>
                <a href="${link}" target="_blank" style="color:#3b82f6; text-decoration:none;">${link}</a></p>
              <p style="margin:0;">Əgər bu istəyi siz etməmisinizsə, bu məktubu nəzərə almayın.</p>
              <p style="margin:16px 0 0 0;">Hörmətlə,<br/>LNK komandası</p>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
