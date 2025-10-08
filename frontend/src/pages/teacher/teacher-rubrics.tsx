import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { PageHeader } from '../../components/page-header';
import { Plus, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

export function TeacherRubrics() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div>
      <PageHeader
        title="Rubrics"
        description="Create and manage grading rubrics"
        actions={
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 size-4" />
            Create Rubric
          </Button>
        }
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Standard Essay Rubric</CardTitle>
                <Button variant="ghost" size="sm">
                  <Edit className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Criteria</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Max Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Content & Analysis</TableCell>
                    <TableCell>40%</TableCell>
                    <TableCell>40</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Organization</TableCell>
                    <TableCell>30%</TableCell>
                    <TableCell>30</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Grammar & Mechanics</TableCell>
                    <TableCell>30%</TableCell>
                    <TableCell>30</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

