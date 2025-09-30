import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, ROLE_PERMISSIONS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function initializePermissions() {
  try {
    console.log('Initializing permissions and roles...');

    // Create all permissions
    for (const permission of Object.values(PERMISSIONS)) {
      await prisma.permission.upsert({
        where: {
          resource_action: {
            resource: permission.resource,
            action: permission.action,
          },
        },
        update: {},
        create: {
          name: `${permission.resource}_${permission.action}`.toUpperCase(),
          description: `${permission.action} ${permission.resource}`,
          resource: permission.resource,
          action: permission.action,
        },
      });
    }

    console.log('✅ Permissions created/updated');

    // Create default roles
    for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: {
          name: roleName,
          description: `Default ${roleName.toLowerCase()} role`,
          isSystem: true,
        },
      });

      console.log(`✅ Role ${roleName} created/updated`);

      // Assign permissions to role
      for (const permission of permissions) {
        const permissionRecord = await prisma.permission.findFirst({
          where: {
            resource: permission.resource,
            action: permission.action,
          },
        });

        if (permissionRecord) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permissionRecord.id,
              },
            },
            update: {},
            create: {
              roleId: role.id,
              permissionId: permissionRecord.id,
              granted: true,
            },
          });
        }
      }

      console.log(`✅ Permissions assigned to role ${roleName}`);
    }

    console.log('🎉 Permissions and roles initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing permissions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
if (require.main === module) {
  initializePermissions()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { initializePermissions };
