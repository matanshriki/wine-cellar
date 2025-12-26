import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo123', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'demo@winecellarbrain.com' },
    update: {},
    create: {
      email: 'demo@winecellarbrain.com',
      passwordHash,
      name: 'Demo User',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Sample bottles
  const bottles = [
    {
      name: 'Château Margaux',
      producer: 'Château Margaux',
      vintage: 2015,
      region: 'Bordeaux, France',
      grapes: 'Cabernet Sauvignon, Merlot, Cabernet Franc',
      style: 'red',
      rating: 98,
      quantity: 2,
      purchasePrice: 450,
      notes: 'Premier Grand Cru Classé. Elegant and complex.',
    },
    {
      name: 'Opus One',
      producer: 'Opus One Winery',
      vintage: 2018,
      region: 'Napa Valley, USA',
      grapes: 'Cabernet Sauvignon, Merlot, Cabernet Franc, Petit Verdot, Malbec',
      style: 'red',
      rating: 96,
      quantity: 1,
      purchasePrice: 350,
      notes: 'Bordeaux-style blend from California.',
    },
    {
      name: 'Dom Pérignon',
      producer: 'Moët & Chandon',
      vintage: 2012,
      region: 'Champagne, France',
      grapes: 'Chardonnay, Pinot Noir',
      style: 'sparkling',
      rating: 97,
      quantity: 3,
      purchasePrice: 200,
      notes: 'Vintage champagne. Perfect for celebrations.',
    },
    {
      name: 'Cloudy Bay Sauvignon Blanc',
      producer: 'Cloudy Bay',
      vintage: 2022,
      region: 'Marlborough, New Zealand',
      grapes: 'Sauvignon Blanc',
      style: 'white',
      rating: 90,
      quantity: 4,
      purchasePrice: 30,
      notes: 'Crisp and refreshing. Great with seafood.',
    },
    {
      name: 'Barolo Riserva',
      producer: 'Giacomo Conterno',
      vintage: 2013,
      region: 'Piedmont, Italy',
      grapes: 'Nebbiolo',
      style: 'red',
      rating: 97,
      quantity: 1,
      purchasePrice: 300,
      notes: 'King of wines. Needs time to breathe.',
    },
    {
      name: 'Penfolds Grange',
      producer: 'Penfolds',
      vintage: 2016,
      region: 'South Australia',
      grapes: 'Shiraz',
      style: 'red',
      rating: 98,
      quantity: 1,
      purchasePrice: 600,
      notes: "Australia's most celebrated wine.",
    },
    {
      name: 'Chablis Grand Cru Les Clos',
      producer: 'Domaine William Fèvre',
      vintage: 2020,
      region: 'Burgundy, France',
      grapes: 'Chardonnay',
      style: 'white',
      rating: 94,
      quantity: 2,
      purchasePrice: 80,
      notes: 'Mineral-driven white Burgundy.',
    },
    {
      name: 'Rioja Gran Reserva',
      producer: 'La Rioja Alta',
      vintage: 2012,
      region: 'Rioja, Spain',
      grapes: 'Tempranillo, Graciano, Mazuelo',
      style: 'red',
      rating: 93,
      quantity: 3,
      purchasePrice: 50,
      notes: 'Classic Spanish red. Well-aged.',
    },
    {
      name: 'Whispering Angel',
      producer: 'Château d\'Esclans',
      vintage: 2022,
      region: 'Provence, France',
      grapes: 'Grenache, Rolle, Cinsault',
      style: 'rose',
      rating: 88,
      quantity: 6,
      purchasePrice: 25,
      notes: 'Popular Provence rosé. Summer in a bottle.',
    },
    {
      name: 'Tignanello',
      producer: 'Antinori',
      vintage: 2018,
      region: 'Tuscany, Italy',
      grapes: 'Sangiovese, Cabernet Sauvignon, Cabernet Franc',
      style: 'red',
      rating: 95,
      quantity: 2,
      purchasePrice: 100,
      notes: 'Super Tuscan. Modern Italian classic.',
    },
  ];

  for (const bottleData of bottles) {
    const bottle = await prisma.bottle.create({
      data: {
        ...bottleData,
        userId: user.id,
      },
    });

    // Create analysis for each bottle
    const currentYear = new Date().getFullYear();
    const age = currentYear - (bottle.vintage || currentYear);

    let readinessStatus = 'Unknown';
    let drinkFromYear = bottle.vintage || currentYear;
    let drinkToYear = (bottle.vintage || currentYear) + 10;
    let decantMinutes = 0;
    let serveTempC = 16;
    let explanation = '';

    switch (bottle.style) {
      case 'white':
        serveTempC = 10;
        if (age <= 3) {
          readinessStatus = 'InWindow';
          explanation = 'This white wine is fresh and ready to enjoy now.';
        } else {
          readinessStatus = 'Peak';
          explanation = 'Mature white wine. Drink soon for best quality.';
        }
        break;

      case 'rose':
        serveTempC = 8;
        if (age <= 1) {
          readinessStatus = 'InWindow';
          explanation = 'Rosé is best enjoyed young and fresh.';
        } else {
          readinessStatus = 'PastPeak';
          explanation = 'This rosé may be past its prime. Consume soon.';
        }
        break;

      case 'sparkling':
        serveTempC = 6;
        readinessStatus = 'InWindow';
        explanation = 'Vintage champagne can age beautifully. Perfect for special occasions.';
        break;

      case 'red':
      default:
        serveTempC = 16;
        decantMinutes = 45;
        if (age < 3) {
          readinessStatus = 'TooYoung';
          drinkFromYear = currentYear + 2;
          explanation = 'Young red wine. Will benefit from additional aging.';
        } else if (age < 7) {
          readinessStatus = 'Approaching';
          explanation = 'This red is developing nicely. Decant before serving.';
        } else if (age <= 12) {
          readinessStatus = 'InWindow';
          explanation = 'In prime drinking window. Exceptional complexity.';
        } else {
          readinessStatus = 'Peak';
          explanation = 'Mature wine at peak. Enjoy soon.';
        }
        break;
    }

    await prisma.bottleAnalysis.create({
      data: {
        bottleId: bottle.id,
        readinessStatus,
        drinkFromYear,
        drinkToYear,
        decantMinutes,
        serveTempC,
        explanation,
        aiGenerated: false,
      },
    });

    console.log(`✅ Added: ${bottle.name} (${bottle.vintage})`);
  }

  // Add some sample open events
  const sampleEvents = [
    {
      bottleName: 'Cloudy Bay Sauvignon Blanc',
      mealType: 'fish',
      occasion: 'casual',
      vibe: 'easy_drinking',
      userRating: 5,
      notes: 'Perfect pairing with grilled salmon!',
      daysAgo: 7,
    },
    {
      bottleName: 'Whispering Angel',
      mealType: 'custom',
      occasion: 'hosting_friends',
      vibe: 'crowd_pleaser',
      userRating: 4,
      notes: 'Everyone loved it at the BBQ.',
      daysAgo: 14,
    },
  ];

  for (const event of sampleEvents) {
    const bottle = await prisma.bottle.findFirst({
      where: {
        userId: user.id,
        name: event.bottleName,
      },
    });

    if (bottle) {
      await prisma.openEvent.create({
        data: {
          userId: user.id,
          bottleId: bottle.id,
          mealType: event.mealType,
          occasion: event.occasion,
          vibe: event.vibe,
          userRating: event.userRating,
          notes: event.notes,
          openedAt: new Date(Date.now() - event.daysAgo * 24 * 60 * 60 * 1000),
        },
      });

      console.log(`✅ Added open event for: ${event.bottleName}`);
    }
  }

  console.log('🎉 Seeding complete!');
  console.log('\nDemo credentials:');
  console.log('Email: demo@winecellarbrain.com');
  console.log('Password: demo123');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

