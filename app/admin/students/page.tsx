'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, serverTimestamp, doc, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { Plus, Upload, Trash2, Search, GraduationCap, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MasterRecordsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [isAdding, setIsAdding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newStudent, setNewStudent] = useState({
    studentId: '',
    fullName: '',
    email: '',
    department: ''
  });
  const [csvContent, setCsvContent] = useState('');

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'students_master'), orderBy('createdAt', 'desc'), limit(100));
      const querySnapshot = await getDocs(q);
      const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load student records");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.studentId || !newStudent.fullName) {
      toast.error("Student ID and Full Name are required");
      return;
    }

    try {
      // Use studentId as document ID for easy lookup
      const docRef = doc(db, 'students_master', newStudent.studentId);
      await setDoc(docRef, {
        ...newStudent,
        createdAt: serverTimestamp()
      });
      
      toast.success("Student record added successfully");
      setNewStudent({ studentId: '', fullName: '', email: '', department: '' });
      setIsAdding(false);
      fetchStudents();
    } catch (error) {
      console.error("Error adding student:", error);
      toast.error("Failed to add student record");
    }
  };

  const handleCsvUpload = async () => {
    if (!csvContent.trim()) {
      toast.error("Please paste CSV content");
      return;
    }

    const lines = csvContent.split('\n');
    let successCount = 0;
    let failCount = 0;

    toast.loading("Processing CSV...", { id: 'csv' });

    for (const line of lines) {
      const [studentId, fullName, email, department] = line.split(',').map(s => s.trim());
      if (studentId && fullName) {
        try {
          const docRef = doc(db, 'students_master', studentId);
          await setDoc(docRef, {
            studentId,
            fullName,
            email: email || '',
            department: department || '',
            createdAt: serverTimestamp()
          });
          successCount++;
        } catch (e) {
          failCount++;
        }
      }
    }

    toast.dismiss('csv');
    toast.success(`Imported ${successCount} records. ${failCount} failed.`);
    setCsvContent('');
    setIsUploading(false);
    fetchStudents();
  };

  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'students_master', studentToDelete));
      toast.success("Record deleted");
      fetchStudents();
      setStudentToDelete(null);
    } catch (error) {
      toast.error("Failed to delete record");
      setStudentToDelete(null);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Student Records</h1>
          <p className="text-sm text-gray-500">Manage the official university dataset for verification.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsAdding(true); setIsUploading(false); }}
            className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Manually
          </button>
          <button 
            onClick={() => { setIsUploading(true); setIsAdding(false); }}
            className="flex items-center gap-2 bg-white border border-gray-200 text-black px-4 py-2 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all shadow-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
        </div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="font-bold text-lg mb-6">Add New Student Record</h3>
          <form onSubmit={handleAddStudent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student ID *</label>
              <input 
                type="text" 
                value={newStudent.studentId}
                onChange={(e) => setNewStudent({...newStudent, studentId: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. STU12345"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name *</label>
              <input 
                type="text" 
                value={newStudent.fullName}
                onChange={(e) => setNewStudent({...newStudent, fullName: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. John Doe"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email (Optional)</label>
              <input 
                type="email" 
                value={newStudent.email}
                onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. john@university.edu"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Department (Optional)</label>
              <input 
                type="text" 
                value={newStudent.department}
                onChange={(e) => setNewStudent({...newStudent, department: e.target.value})}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 mt-4">
              <button 
                type="button" 
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
              >
                Save Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CSV Upload */}
      {isUploading && (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Import Student Records</h3>
              <p className="text-sm text-gray-500">Paste comma-separated values below.</p>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-2xl mb-6 flex items-start gap-3 border border-blue-100">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 leading-relaxed">
              Format: <code className="font-bold">student_id, full_name, email, department</code><br />
              Example: <code className="font-bold">STU001, John Doe, john@uni.edu, Science</code>
            </div>
          </div>

          <textarea 
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full h-48 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-black font-mono text-sm mb-4"
            placeholder="STU001, John Doe, john@uni.edu, Science&#10;STU002, Jane Smith, jane@uni.edu, Arts"
          />

          <div className="flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => setIsUploading(false)}
              className="px-6 py-2 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleCsvUpload}
              className="px-6 py-2 bg-black text-white rounded-xl font-bold text-sm hover:bg-gray-800 transition-all"
            >
              Start Import
            </button>
          </div>
        </div>
      )}

      {/* Search and List */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by name or ID..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black text-sm"
            />
          </div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            Total Records: {students.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
                <th className="px-6 py-4">Student ID</th>
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Department</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-spin w-6 h-6 border-2 border-black border-t-transparent rounded-full mx-auto mb-2"></div>
                    Loading records...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    No student records found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-bold text-gray-900">{student.studentId}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-gray-900">{student.fullName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.department || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.email || 'N/A'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setStudentToDelete(student.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4">Delete Record</h3>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete this student record? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setStudentToDelete(null)}
                className="flex-1 bg-gray-100 text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
