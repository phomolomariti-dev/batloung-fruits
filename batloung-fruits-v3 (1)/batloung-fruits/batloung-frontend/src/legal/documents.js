import { COMPANY as C } from './company';

// Body items: a string is a paragraph, { list: [...] } a bullet list, { table: { head, rows } } a table.
const contact = `You can reach us at ${C.email} or ${C.phone}, or visit ${C.address}.`;

export const DOCS = [
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    short: 'Terms',
    summary: 'The rules for using the Batloung Fruits ordering and stock system.',
    sections: [
      { h: 'Who we are', body: [
        `${C.name} buys fruit from suppliers in South Africa and sells it by the box to registered street vendors in Maseru. This system is how staff and vendors manage stock, vendors and orders.`,
        'By signing in you confirm that you have read and agree to these Terms, the Privacy Policy and the Refund & Cancellation Policy.',
      ] },
      { h: 'Accounts and roles', body: [
        'Accounts are for the person they were created for. There are two roles: Administrator, who manages suppliers, fruit, stock, vendors, orders, reports and users, and Sales, who can view products, register vendors, and create and view orders.',
        'You can create a Sales account yourself. An Administrator account needs an access code from the people who run the system, and an administrator can change anyone’s role or switch an account off at any time.',
        { list: [
          'Keep your password, and your Google, GitHub, Apple or Facebook account, secure. You are responsible for what is done through your account.',
          'Tell us straight away if you think someone else has used your account.',
          'We may suspend an account that breaks these Terms or the Acceptable Use Policy.',
        ] },
      ] },
      { h: 'Vendors and orders', body: [
        { list: [
          'An order can only be placed for a registered, active street vendor and must contain at least one item with a quantity above zero.',
          'We cannot accept an order for more boxes than we have in stock. Stock is checked when the order is placed and again when it is completed.',
          'Each fruit and box size (Small, Medium, Large) is a separate product with its own price and stock.',
          'The price you see when an order is placed is the price for that order, even if the price changes later.',
          'An order moves through these statuses: Pending, Confirmed, Processing, Ready for Collection/Delivery, Completed or Cancelled. Stock is reduced when an order is Completed. A Cancelled order does not reduce stock.',
        ] },
      ] },
      { h: 'Prices and payment', body: [
        'Prices are shown per box in the currency displayed on screen. Totals are calculated by the system as quantity multiplied by unit price, added across all items. We may correct an obvious pricing error before an order is completed and will tell you if we do.',
      ] },
      { h: 'Collection and delivery', body: [
        'Orders marked Ready for Collection/Delivery should be collected or received promptly. Fresh fruit is perishable, so please inspect your order on collection or delivery and report problems as set out in the Refund & Cancellation Policy.',
      ] },
      { h: 'Using the system', body: [
        'You agree to follow the Acceptable Use Policy. Information you enter, such as vendor details and order quantities, must be accurate.',
      ] },
      { h: 'Our responsibility', body: [
        'We work to keep the system available and accurate, but we cannot promise it will always be uninterrupted or error free. To the extent the law allows, we are not responsible for indirect losses, such as lost sales caused by a temporary outage. Nothing in these Terms limits any right you have under law that cannot be limited.',
      ] },
      { h: 'Changes to these Terms', body: [
        'We may update these Terms. When the change matters, the version date at the top of this page changes and you will be asked to agree again the next time you sign in.',
      ] },
      { h: 'Governing law and contact', body: [
        `These Terms are governed by the laws of ${C.country}. ${contact}`,
      ] },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    short: 'Privacy',
    summary: 'What personal information we collect, why, and the choices you have.',
    sections: [
      { h: 'What we collect', body: [
        { list: [
          'Account details: your name, email address, role, and a securely hashed password. We never store your password in readable form.',
          'Social sign-in: if you continue with Google, GitHub, Apple or Facebook, we receive your name, your verified email address, your profile picture if the provider shares one, and an identifier for that provider account. We never see your password for that provider and we never post anything for you.',
          'Vendor details: vendor name, business name, telephone number, area in Maseru and registration date.',
          'Business records: orders, order items, purchases from suppliers, and stock movements, including which user created them.',
          'Consent records: the version of the Terms you accepted and when.',
          'Technical data: your internet address is used briefly to limit repeated sign-in attempts.',
        ] },
      ] },
      { h: 'Why we use it', body: [
        { list: [
          'To let you sign in and to give you the right access for your role.',
          'To register vendors, take and fulfil orders, record stock and produce business reports.',
          'To keep the system secure and to prevent misuse.',
          'To keep proof that the Terms were accepted.',
        ] },
        'We do not sell your personal information and we do not use it for advertising.',
      ] },
      { h: 'Who we share it with', body: [
        'Only with people and services needed to run the system, such as our hosting and database provider, and the sign-in provider you choose to use. We may disclose information if the law requires it.',
      ] },
      { h: 'How long we keep it', body: [
        'We keep account data while the account is active. Order and purchase records are kept as long as we need them for accounting, tax and dispute purposes. You can ask us to delete or anonymise data that we no longer need to keep.',
      ] },
      { h: 'Security', body: [
        'Passwords are hashed, access is controlled by role, and sign-in sessions use signed tokens that expire. No system is perfectly secure, so please use a strong, unique password.',
      ] },
      { h: 'Your choices and rights', body: [
        { list: [
          'Ask to see the personal information we hold about you.',
          'Ask us to correct information that is wrong or incomplete.',
          'Ask us to delete your information, where we are not required to keep it.',
          'Choose your cookie settings at any time (see the Cookie Policy).',
        ] },
        `To use any of these rights, contact us. ${contact}`,
      ] },
      { h: 'Children', body: ['The system is for business use and is not meant for children.'] },
      { h: 'Changes', body: ['If we change this policy in an important way, we will update the date on this page and, where needed, ask you to agree again.'] },
    ],
  },
  {
    slug: 'refunds',
    title: 'Refund & Cancellation Policy',
    short: 'Refunds',
    summary: 'When an order can be cancelled and when you can claim a refund, credit or replacement.',
    sections: [
      { h: 'Cancelling an order', body: [
        { list: [
          'You can cancel an order for free while it is Pending or Confirmed.',
          'Once an order is Processing, we may already have packed it. Contact us as soon as possible and we will do our best to stop it, but we cannot promise to.',
          'A cancelled order is not charged and does not reduce our stock. A Completed order cannot be cancelled in the system, so use the refund steps below.',
        ] },
      ] },
      { h: 'Problems with your fruit', body: [
        'Fresh fruit is perishable, so please check your order when you collect or receive it and tell us within 24 hours. You may claim if:',
        { list: [
          'the fruit arrived damaged, rotten or spoiled beyond normal ripeness;',
          'you received the wrong fruit or the wrong box size;',
          'the number of boxes is less than the order says.',
        ] },
        'Please send the order number and clear photos of the fruit and boxes.',
      ] },
      { h: 'What we cannot refund', body: [
        { list: [
          'Normal variation in size, colour or ripeness, which is natural for fresh fruit.',
          'Fruit that spoiled because of how it was stored after collection.',
          'A change of mind after the order was collected.',
          'Claims made more than 24 hours after collection or delivery.',
        ] },
      ] },
      { h: 'How we put it right', body: [
        'After checking your claim, we will offer one of the following, depending on the problem and on stock: a replacement, a credit on your next order, or a refund by the same method you paid. Refunds are made within 7 working days of approval.',
      ] },
      { h: 'Contact', body: [contact] },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    short: 'Cookies',
    summary: 'The small pieces of data this site stores in your browser, and how to control them.',
    sections: [
      { h: 'What we store', body: [
        'We use cookies and similar browser storage only for the things below. We do not use advertising or analytics cookies, and we do not share this data with advertisers.',
        { table: {
          head: ['Name', 'Type', 'What it does', 'How long'],
          rows: [
            ['bf_token', 'Strictly necessary', 'Keeps you signed in to the system.', 'Until you sign out or the session expires'],
            ['bf_oauth', 'Strictly necessary', 'Protects social sign-in from forgery. Set only while you are signing in with Google, GitHub, Apple or Facebook.', '10 minutes'],
            ['bf_consent', 'Strictly necessary', 'Remembers the cookie choice you made.', '180 days'],
            ['bf_remember_email', 'Preferences (only if you accept)', 'Fills in your email on the sign-in page next time.', 'Until you clear it or change your choice'],
          ],
        } },
      ] },
      { h: 'Your choice', body: [
        'After you sign in, you can accept all cookies or reject the ones that are not strictly necessary. Strictly necessary items cannot be switched off, because the system would not work without them. If you reject, the system works exactly the same, but it will not remember your email on the sign-in page.',
        'You can change your mind at any time using Cookie settings at the bottom of the menu. You can also delete cookies in your browser settings.',
      ] },
      { h: 'Third parties', body: [
        'When you choose to continue with Google, GitHub, Apple or Facebook, you leave our site for theirs. They may set their own cookies, which are covered by their own policies.',
      ] },
      { h: 'Contact', body: [contact] },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    short: 'Acceptable use',
    summary: 'What you must not do when using the system.',
    sections: [
      { h: 'You must not', body: [
        { list: [
          'share your sign-in details or use someone else’s account;',
          'try to reach data or features your role does not allow, or look for ways around the access controls;',
          'register vendors that do not exist, or place orders you do not intend to collect;',
          'enter false or misleading information, including prices, quantities or contact details;',
          'overload, scan, copy in bulk or interfere with the system or its data;',
          'upload or send anything harmful, unlawful or abusive.',
        ] },
      ] },
      { h: 'What can happen', body: [
        'We may warn you, limit your access, suspend your account or report unlawful activity to the authorities, depending on how serious the misuse is.',
      ] },
      { h: 'Reporting a problem', body: [`If you find a security problem or see misuse, please tell us straight away. ${contact}`] },
    ],
  },
];

export const docBySlug = (slug) => DOCS.find((d) => d.slug === slug);
