// Identity invitation and recovery emails may land on the public homepage.
if (/(?:invite|recovery|confirmation|email_change)_token=|access_token=/.test(location.hash)) location.replace('/admin/'+location.hash);
